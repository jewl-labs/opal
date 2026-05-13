import { describe, it, expect, beforeAll } from "bun:test";
import { createHash, randomBytes } from "crypto";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
} from "@solana/spl-token";

import idl from "../target/idl/opal.json";
import type { Opal } from "../target/types/opal";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

const SEEDS = {
  PROTOCOL_CONFIG: Buffer.from("protocol_config"),
  ASSERTION: Buffer.from("assertion"),
  BOND_VAULT: Buffer.from("bond_vault"),
  LLM_DISPUTE: Buffer.from("llm_dispute"),
  VOTE_DISPUTE: Buffer.from("vote_dispute"),
  LLM_ROUND: Buffer.from("llm_round"),
  VOTE_ROUND: Buffer.from("vote_round"),
  VOTE_RECORD: Buffer.from("vote_record"),
  OPAL_ESCROW: Buffer.from("opal_escrow"),
};

const STATE = {
  ASSERTED: 0,
  PENDING_LLM: 1,
  ASSERTED_LLM: 2,
  PENDING_VOTE: 3,
  VOTING: 4,
  RESOLVED: 5,
};

const OUTCOME = {
  TRUE: 0,
  FALSE: 1,
  TOO_EARLY: 2,
  UNRESOLVABLE: 3,
  NONE: 255,
};

// ─── Utility helpers ──────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fund(connection: Connection, pk: PublicKey, lamports: number) {
  const sig = await connection.requestAirdrop(pk, lamports);
  await connection.confirmTransaction(sig, "confirmed");
}

async function balanceOf(connection: Connection, ata: PublicKey) {
  const acc = await getAccount(connection, ata, "confirmed");
  return Number(acc.amount);
}

/** SHA-256(outcome_byte || nonce) — mirrors the Rust commit hash */
function computeCommitHash(outcome: number, nonce: Buffer): number[] {
  const preimage = Buffer.alloc(33);
  preimage[0] = outcome;
  nonce.copy(preimage, 1);
  return Array.from(createHash("sha256").update(preimage).digest());
}

function randomNonce(): Buffer {
  return randomBytes(32);
}

// ─── PDA derivation ───────────────────────────────────────────────────────────

function derivePDAs(id: PublicKey, programId: PublicKey) {
  const [assertion] = PublicKey.findProgramAddressSync(
    [SEEDS.ASSERTION, id.toBuffer()],
    programId,
  );
  const [bondVault] = PublicKey.findProgramAddressSync(
    [SEEDS.BOND_VAULT, id.toBuffer()],
    programId,
  );
  const [llmDispute] = PublicKey.findProgramAddressSync(
    [SEEDS.LLM_DISPUTE, assertion.toBuffer()],
    programId,
  );
  const [llmRound] = PublicKey.findProgramAddressSync(
    [SEEDS.LLM_ROUND, assertion.toBuffer()],
    programId,
  );
  const [voteDispute] = PublicKey.findProgramAddressSync(
    [SEEDS.VOTE_DISPUTE, assertion.toBuffer()],
    programId,
  );
  const [voteRound] = PublicKey.findProgramAddressSync(
    [SEEDS.VOTE_ROUND, assertion.toBuffer()],
    programId,
  );
  return { assertion, bondVault, llmDispute, llmRound, voteDispute, voteRound };
}

function deriveVoteRecord(
  voteRound: PublicKey,
  voter: PublicKey,
  programId: PublicKey,
): PublicKey {
  const [pk] = PublicKey.findProgramAddressSync(
    [SEEDS.VOTE_RECORD, voteRound.toBuffer(), voter.toBuffer()],
    programId,
  );
  return pk;
}

function deriveOpalEscrow(
  voteRound: PublicKey,
  voter: PublicKey,
  programId: PublicKey,
): PublicKey {
  const [pk] = PublicKey.findProgramAddressSync(
    [SEEDS.OPAL_ESCROW, voteRound.toBuffer(), voter.toBuffer()],
    programId,
  );
  return pk;
}

// ─── Environment ─────────────────────────────────────────────────────────────

// Protocol config parameters used across all tests.
// Voting windows are short so tests complete quickly.
const PROTOCOL_PARAMS = {
  assertionBondMinPusd: new BN(100),
  llmDisputeBondRatioBps: 5000,  // 50%
  voteDisputeBondRatioBps: 3000, // 30%
  protocolFeeBps: 250,           // 2.5%
  llmDisputerRewardShareBps: 3000,
  voteDisputerRewardShareBps: 2500,
  voterRewardShareBps: 2500,     // 25% of vote_bond goes to winning voters
  treasuryShareBps: 2000,
  supermajorityBps: 6700,        // 67%
  livenessWindowSeconds: new BN(2),
  llmChallengeWindowSeconds: new BN(3),
  voteSetupWindowSeconds: new BN(0),
  votingWindowSeconds: new BN(5),
  revealWindowSeconds: new BN(5),
};

// OPAL balances minted to each voter (0-decimal token for simple integer weights)
const VOTER_OPAL_AMOUNTS = [3000, 2000, 1000] as const;

type TokenEnv = {
  mint: PublicKey;
  opalMint: PublicKey;
  mintAuthority: Keypair;
  opalMintAuthority: Keypair;
  treasury: Keypair;
  asserter: Keypair;
  asserterAta: PublicKey;
  llmDisputer: Keypair;
  llmDisputerAta: PublicKey;
  voteDisputer: Keypair;
  voteDisputerAta: PublicKey;
  voters: [Keypair, Keypair, Keypair];
  voterOpalAtas: [PublicKey, PublicKey, PublicKey];
  voterPusdAtas: [PublicKey, PublicKey, PublicKey];
};

async function buildTokenEnv(connection: Connection): Promise<TokenEnv> {
  const mintAuthority = Keypair.generate();
  const opalMintAuthority = Keypair.generate();
  const treasury = Keypair.generate();
  const asserter = Keypair.generate();
  const llmDisputer = Keypair.generate();
  const voteDisputer = Keypair.generate();
  const voters = [Keypair.generate(), Keypair.generate(), Keypair.generate()] as [
    Keypair,
    Keypair,
    Keypair,
  ];

  for (const kp of [
    mintAuthority,
    opalMintAuthority,
    treasury,
    asserter,
    llmDisputer,
    voteDisputer,
    ...voters,
  ]) {
    await fund(connection, kp.publicKey, 10_000_000_000);
  }

  // PUSD: 6-decimal stablecoin used for bonds
  const mint = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    6,
  );

  // OPAL: 0-decimal governance token used for voting weight
  const opalMint = await createMint(
    connection,
    opalMintAuthority,
    opalMintAuthority.publicKey,
    null,
    0,
  );

  const [treasuryAta, asserterAta, llmDisputerAta, voteDisputerAta] =
    await Promise.all([
      getOrCreateAssociatedTokenAccount(
        connection,
        mintAuthority,
        mint,
        treasury.publicKey,
      ),
      getOrCreateAssociatedTokenAccount(
        connection,
        mintAuthority,
        mint,
        asserter.publicKey,
      ),
      getOrCreateAssociatedTokenAccount(
        connection,
        mintAuthority,
        mint,
        llmDisputer.publicKey,
      ),
      getOrCreateAssociatedTokenAccount(
        connection,
        mintAuthority,
        mint,
        voteDisputer.publicKey,
      ),
    ]);

  for (const acc of [treasuryAta, asserterAta, llmDisputerAta, voteDisputerAta]) {
    await mintTo(
      connection,
      mintAuthority,
      mint,
      acc.address,
      mintAuthority,
      1_000_000_000_000,
    );
  }

  // OPAL ATAs for voters
  const voterOpalAccounts = await Promise.all(
    voters.map((v) =>
      getOrCreateAssociatedTokenAccount(
        connection,
        opalMintAuthority,
        opalMint,
        v.publicKey,
      ),
    ),
  );
  for (let i = 0; i < 3; i++) {
    await mintTo(
      connection,
      opalMintAuthority,
      opalMint,
      voterOpalAccounts[i].address,
      opalMintAuthority,
      VOTER_OPAL_AMOUNTS[i],
    );
  }

  // PUSD ATAs for voters (to receive rewards)
  const voterPusdAccounts = await Promise.all(
    voters.map((v) =>
      getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, v.publicKey),
    ),
  );

  return {
    mint,
    opalMint,
    mintAuthority,
    opalMintAuthority,
    treasury,
    asserter,
    asserterAta: asserterAta.address,
    llmDisputer,
    llmDisputerAta: llmDisputerAta.address,
    voteDisputer,
    voteDisputerAta: voteDisputerAta.address,
    voters,
    voterOpalAtas: voterOpalAccounts.map((a) => a.address) as [
      PublicKey,
      PublicKey,
      PublicKey,
    ],
    voterPusdAtas: voterPusdAccounts.map((a) => a.address) as [
      PublicKey,
      PublicKey,
      PublicKey,
    ],
  };
}

type ProtocolEnv = {
  configPda: PublicKey;
  authority: Keypair;
  treasuryAta: PublicKey;
};

async function setupProtocol(
  program: Program<Opal>,
  token: TokenEnv,
  authority: Keypair,
): Promise<ProtocolEnv> {
  const [configPda] = PublicKey.findProgramAddressSync(
    [SEEDS.PROTOCOL_CONFIG],
    program.programId,
  );

  const treasuryAta = (
    await getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      token.mintAuthority,
      token.mint,
      token.treasury.publicKey,
    )
  ).address;

  await program.methods
    .initializeProtocolConfig({
      ...PROTOCOL_PARAMS,
      opalMint: token.opalMint,
      minQuorumWeight: new BN(1),
    })
    .accounts({
      authority: authority.publicKey,
      protocolConfig: configPda,
      pusdMint: token.mint,
      treasuryPusd: treasuryAta,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc({ commitment: "confirmed" });

  return { configPda, authority, treasuryAta };
}

// ─── Assertion helpers ────────────────────────────────────────────────────────

class Assertion {
  constructor(
    public id: PublicKey,
    public pdas: ReturnType<typeof derivePDAs>,
  ) {}
}

// ─── TestContext ──────────────────────────────────────────────────────────────

class TestContext {
  constructor(
    public program: Program<Opal>,
    public provider: AnchorProvider,
    public connection: Connection,
    public token: TokenEnv,
    public proto: ProtocolEnv,
  ) {}

  newAssertion(): Assertion {
    const id = Keypair.generate().publicKey;
    return new Assertion(id, derivePDAs(id, this.program.programId));
  }

  async createAssertion(
    a: Assertion,
    statement: string,
    bond: number,
    auxiliaryHash = "hash",
  ) {
    return this.program.methods
      .createAssertion({
        assertionId: a.id,
        statement,
        auxiliaryHash,
        assertionBondAmountPusd: new BN(bond),
      })
      .accounts({
        asserter: this.token.asserter.publicKey,
        protocolConfig: this.proto.configPda,
        pusdMint: this.token.mint,
        assertion: a.pdas.assertion,
        bondVault: a.pdas.bondVault,
        asserterPusd: this.token.asserterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.token.asserter])
      .rpc({ commitment: "confirmed" });
  }

  async disputeAssertion(a: Assertion) {
    return this.program.methods
      .disputeAssertion()
      .accounts({
        disputer: this.token.llmDisputer.publicKey,
        protocolConfig: this.proto.configPda,
        pusdMint: this.token.mint,
        assertion: a.pdas.assertion,
        llmDispute: a.pdas.llmDispute,
        llmResolutionRound: a.pdas.llmRound,
        bondVault: a.pdas.bondVault,
        disputerPusd: this.token.llmDisputerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.token.llmDisputer])
      .rpc({ commitment: "confirmed" });
  }

  async submitMockLlmResolution(a: Assertion, outcomeCode: number) {
    return this.program.methods
      .submitMockLlmResolution({ outcomeCode })
      .accounts({
        authority: this.proto.authority.publicKey,
        protocolConfig: this.proto.configPda,
        assertion: a.pdas.assertion,
        llmResolutionRound: a.pdas.llmRound,
      })
      .signers([this.proto.authority])
      .rpc({ commitment: "confirmed" });
  }

  async finalizeLlmResolution(a: Assertion) {
    return this.program.methods
      .finalizeLlmResolution()
      .accounts({
        finalizer: this.provider.wallet.publicKey,
        protocolConfig: this.proto.configPda,
        pusdMint: this.token.mint,
        assertion: a.pdas.assertion,
        llmDispute: a.pdas.llmDispute,
        llmResolutionRound: a.pdas.llmRound,
        bondVault: a.pdas.bondVault,
        asserterPusd: this.token.asserterAta,
        llmDisputerPusd: this.token.llmDisputerAta,
        treasuryPusd: this.proto.treasuryAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });
  }

  async challengeLlmResolution(a: Assertion) {
    return this.program.methods
      .challengeLlmResolution()
      .accounts({
        disputer: this.token.voteDisputer.publicKey,
        protocolConfig: this.proto.configPda,
        pusdMint: this.token.mint,
        assertion: a.pdas.assertion,
        llmResolutionRound: a.pdas.llmRound,
        voteDispute: a.pdas.voteDispute,
        voteResolutionRound: a.pdas.voteRound,
        bondVault: a.pdas.bondVault,
        disputerPusd: this.token.voteDisputerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.token.voteDisputer])
      .rpc({ commitment: "confirmed" });
  }

  /** Production open_vote — requires real MagicBlock delegation accounts. */
  async openVote(a: Assertion) {
    return this.program.methods
      .openVote()
      .accounts({
        authority: this.proto.authority.publicKey,
        protocolConfig: this.proto.configPda,
        assertion: a.pdas.assertion,
        voteResolutionRound: a.pdas.voteRound,
      })
      .signers([this.proto.authority])
      .rpc({ commitment: "confirmed" });
  }

  /** Test-only open_vote — no MagicBlock delegation, sets windows directly. */
  async openVoteMock(a: Assertion) {
    return this.program.methods
      .openVoteMock()
      .accounts({
        authority: this.proto.authority.publicKey,
        protocolConfig: this.proto.configPda,
        assertion: a.pdas.assertion,
        voteResolutionRound: a.pdas.voteRound,
      })
      .signers([this.proto.authority])
      .rpc({ commitment: "confirmed" });
  }

  async undelegateVoteRoundMock(a: Assertion) {
    return this.program.methods
      .undelegateVoteRoundMock()
      .accounts({
        payer: this.provider.wallet.publicKey,
        assertion: a.pdas.assertion,
        voteResolutionRound: a.pdas.voteRound,
      })
      .rpc({ commitment: "confirmed" });
  }

  async castVote(
    a: Assertion,
    voter: Keypair,
    voterOpalAta: PublicKey,
    commitHash: number[],
  ) {
    const voteRecord = deriveVoteRecord(
      a.pdas.voteRound,
      voter.publicKey,
      this.program.programId,
    );
    const opalEscrow = deriveOpalEscrow(
      a.pdas.voteRound,
      voter.publicKey,
      this.program.programId,
    );
    return this.program.methods
      .castVote({ commitHash })
      .accounts({
        voter: voter.publicKey,
        protocolConfig: this.proto.configPda,
        voteResolutionRound: a.pdas.voteRound,
        voteRecord,
        opalMint: this.token.opalMint,
        voterOpal: voterOpalAta,
        opalEscrow,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc({ commitment: "confirmed" });
  }

  async revealVote(
    a: Assertion,
    voter: Keypair,
    outcome: number,
    nonce: Buffer,
  ) {
    const voteRecord = deriveVoteRecord(
      a.pdas.voteRound,
      voter.publicKey,
      this.program.programId,
    );
    return this.program.methods
      .revealVote({ outcome, nonce: Array.from(nonce) })
      .accounts({
        voter: voter.publicKey,
        voteResolutionRound: a.pdas.voteRound,
        voteRecord,
      })
      .signers([voter])
      .rpc({ commitment: "confirmed" });
  }

  async finalizeVoteResolution(a: Assertion) {
    return this.program.methods
      .finalizeVoteResolution()
      .accounts({
        finalizer: this.provider.wallet.publicKey,
        protocolConfig: this.proto.configPda,
        pusdMint: this.token.mint,
        assertion: a.pdas.assertion,
        llmDispute: a.pdas.llmDispute,
        voteDispute: a.pdas.voteDispute,
        voteResolutionRound: a.pdas.voteRound,
        bondVault: a.pdas.bondVault,
        asserterPusd: this.token.asserterAta,
        llmDisputerPusd: this.token.llmDisputerAta,
        voteDisputerPusd: this.token.voteDisputerAta,
        treasuryPusd: this.proto.treasuryAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });
  }

  async claimVoteReward(
    a: Assertion,
    voter: Keypair,
    voterPusdAta: PublicKey,
    voterOpalAta: PublicKey,
  ) {
    const voteRecord = deriveVoteRecord(
      a.pdas.voteRound,
      voter.publicKey,
      this.program.programId,
    );
    const opalEscrow = deriveOpalEscrow(
      a.pdas.voteRound,
      voter.publicKey,
      this.program.programId,
    );
    return this.program.methods
      .claimVoteReward()
      .accounts({
        voter: voter.publicKey,
        opalMint: this.token.opalMint,
        pusdMint: this.token.mint,
        assertion: a.pdas.assertion,
        voteResolutionRound: a.pdas.voteRound,
        voteRecord,
        voterOpal: voterOpalAta,
        opalEscrow,
        bondVault: a.pdas.bondVault,
        voterPusd: voterPusdAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([voter])
      .rpc({ commitment: "confirmed" });
  }

  async finalizeVoteResolutionPlaceholder(a: Assertion, outcomeCode: number) {
    return this.program.methods
      .finalizeVoteResolutionPlaceholder({ outcomeCode })
      .accounts({
        authority: this.proto.authority.publicKey,
        protocolConfig: this.proto.configPda,
        pusdMint: this.token.mint,
        assertion: a.pdas.assertion,
        llmDispute: a.pdas.llmDispute,
        voteDispute: a.pdas.voteDispute,
        voteResolutionRound: a.pdas.voteRound,
        bondVault: a.pdas.bondVault,
        asserterPusd: this.token.asserterAta,
        llmDisputerPusd: this.token.llmDisputerAta,
        voteDisputerPusd: this.token.voteDisputerAta,
        treasuryPusd: this.proto.treasuryAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([this.proto.authority])
      .rpc({ commitment: "confirmed" });
  }

  async finalizeUndisputed(a: Assertion) {
    return this.program.methods
      .finalizeUndisputed()
      .accounts({
        finalizer: this.provider.wallet.publicKey,
        protocolConfig: this.proto.configPda,
        pusdMint: this.token.mint,
        assertion: a.pdas.assertion,
        bondVault: a.pdas.bondVault,
        asserterPusd: this.token.asserterAta,
        treasuryPusd: this.proto.treasuryAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });
  }

  // ── Fetchers ────────────────────────────────────────────────────────────────

  fetchAssertion(a: Assertion) {
    return this.program.account.assertionAccount.fetch(a.pdas.assertion);
  }
  fetchLlmDispute(a: Assertion) {
    return this.program.account.llmDisputeAccount.fetch(a.pdas.llmDispute);
  }
  fetchLlmRound(a: Assertion) {
    return this.program.account.llmResolutionRound.fetch(a.pdas.llmRound);
  }
  fetchVoteDispute(a: Assertion) {
    return this.program.account.voteDisputeAccount.fetch(a.pdas.voteDispute);
  }
  fetchVoteRound(a: Assertion) {
    return this.program.account.voteResolutionRound.fetch(a.pdas.voteRound);
  }
  fetchVoteRecord(a: Assertion, voter: Keypair) {
    const pk = deriveVoteRecord(
      a.pdas.voteRound,
      voter.publicKey,
      this.program.programId,
    );
    return this.program.account.voteRecord.fetch(pk);
  }

  // ── Scenario helpers ────────────────────────────────────────────────────────

  /**
   * Drives an assertion through: create → dispute → llmResolution → challenge → openVoteMock.
   * After this the assertion is in VOTING state with windows starting immediately.
   * @param llmOutcome  The outcome the LLM mock returns (default TRUE).
   */
  async setupVoting(a: Assertion, bond = 500, llmOutcome = OUTCOME.TRUE) {
    await this.createAssertion(a, "Vote test assertion", bond, "vh");
    await this.disputeAssertion(a);
    await this.submitMockLlmResolution(a, llmOutcome);
    await this.challengeLlmResolution(a);
    await this.openVoteMock(a);
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("opal", () => {
  let provider: AnchorProvider;
  let connection: Connection;
  let program: Program<Opal>;
  let token: TokenEnv;
  let proto: ProtocolEnv;
  let ctx: TestContext;

  beforeAll(async () => {
    provider = AnchorProvider.env();
    anchor.setProvider(provider);
    // Patch sendAndConfirm so every .rpc() call skips preflight simulation.
    // On localnet the validator can advance slots faster than the simulation round-trip,
    // causing "Blockhash not found" from preflight even when the tx itself would succeed.
    const _sendAndConfirm = provider.sendAndConfirm.bind(provider);
    (provider as any).sendAndConfirm = (tx: any, signers?: any, opts?: any) =>
      _sendAndConfirm(tx, signers, { skipPreflight: true, ...opts });
    connection = provider.connection;
    program = anchor.workspace.Opal as Program<Opal>;
    token = await buildTokenEnv(connection);
  });

  // ── Protocol initialization ────────────────────────────────────────────────

  it("rejects protocol config with zero assertion bond", async () => {
    const authority = Keypair.generate();
    await fund(connection, authority.publicKey, 10_000_000_000);

    const [configPda] = PublicKey.findProgramAddressSync(
      [SEEDS.PROTOCOL_CONFIG],
      program.programId,
    );
    const treasuryAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        token.mintAuthority,
        token.mint,
        token.treasury.publicKey,
      )
    ).address;

    await expect(
      program.methods
        .initializeProtocolConfig({
          ...PROTOCOL_PARAMS,
          assertionBondMinPusd: new BN(0), // invalid
          opalMint: token.opalMint,
          minQuorumWeight: new BN(1),
        })
        .accounts({
          authority: authority.publicKey,
          protocolConfig: configPda,
          pusdMint: token.mint,
          treasuryPusd: treasuryAta,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow();
  });

  it("rejects protocol config with invalid supermajority (≤50%)", async () => {
    const authority = Keypair.generate();
    await fund(connection, authority.publicKey, 10_000_000_000);
    const [configPda] = PublicKey.findProgramAddressSync(
      [SEEDS.PROTOCOL_CONFIG],
      program.programId,
    );
    const treasuryAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        token.mintAuthority,
        token.mint,
        token.treasury.publicKey,
      )
    ).address;

    await expect(
      program.methods
        .initializeProtocolConfig({
          ...PROTOCOL_PARAMS,
          supermajorityBps: 5000, // exactly 50% — must be >50%
          opalMint: token.opalMint,
          minQuorumWeight: new BN(1),
        })
        .accounts({
          authority: authority.publicKey,
          protocolConfig: configPda,
          pusdMint: token.mint,
          treasuryPusd: treasuryAta,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow();
  });

  it("rejects protocol config with zero voting window", async () => {
    const authority = Keypair.generate();
    await fund(connection, authority.publicKey, 10_000_000_000);
    const [configPda] = PublicKey.findProgramAddressSync(
      [SEEDS.PROTOCOL_CONFIG],
      program.programId,
    );
    const treasuryAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        token.mintAuthority,
        token.mint,
        token.treasury.publicKey,
      )
    ).address;

    await expect(
      program.methods
        .initializeProtocolConfig({
          ...PROTOCOL_PARAMS,
          revealWindowSeconds: new BN(0), // invalid
          opalMint: token.opalMint,
          minQuorumWeight: new BN(1),
        })
        .accounts({
          authority: authority.publicKey,
          protocolConfig: configPda,
          pusdMint: token.mint,
          treasuryPusd: treasuryAta,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow();
  });

  it("initializes protocol config successfully", async () => {
    proto = await setupProtocol(program, token, provider.wallet.payer);
    ctx = new TestContext(program, provider, connection, token, proto);
  });

  // ── Undisputed path ────────────────────────────────────────────────────────

  it("undisputed: creates assertion then finalizes with correct payouts", async () => {
    const a = ctx.newAssertion();
    const bond = 200;
    const asserterStart = await balanceOf(connection, token.asserterAta);
    const treasuryStart = await balanceOf(connection, proto.treasuryAta);

    await ctx.createAssertion(a, "Bitcoin > $100k by 2026", bond, "hash123");

    const acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.ASSERTED);
    expect(acc.disputeCount).toBe(0);
    expect(acc.outcome).toBe(OUTCOME.NONE);

    await sleep(3000);

    await ctx.finalizeUndisputed(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.TRUE);
    expect(resolved.finalizedAt.toNumber()).toBeGreaterThan(0);

    // fee = 200 * 250 / 10000 = 5; asserter gets bond - fee = 195
    expect(await balanceOf(connection, token.asserterAta)).toBe(
      asserterStart - bond + (bond - 5),
    );
    expect(await balanceOf(connection, proto.treasuryAta)).toBe(
      treasuryStart + 5,
    );
  });

  // ── LLM resolution path ────────────────────────────────────────────────────

  it("llm path: disputer correct (LLM says FALSE), disputer wins bonds", async () => {
    const a = ctx.newAssertion();
    const bond = 200;
    const disputerStart = await balanceOf(connection, token.llmDisputerAta);

    await ctx.createAssertion(a, "ETH flips BTC", bond, "abc");
    await ctx.disputeAssertion(a);

    let acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.PENDING_LLM);
    expect(acc.disputeCount).toBe(1);

    await ctx.submitMockLlmResolution(a, OUTCOME.FALSE);

    acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.ASSERTED_LLM);

    const round = await ctx.fetchLlmRound(a);
    expect(round.outcome).toBe(OUTCOME.FALSE);
    expect(round.challengeDeadline.toNumber()).toBeGreaterThan(0);

    await sleep(6000); // past challenge window

    await ctx.finalizeLlmResolution(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.FALSE);

    const dispute = await ctx.fetchLlmDispute(a);
    expect(dispute.settlementResolution).toBe(OUTCOME.FALSE);

    // disputer was correct: receives payout = llm_bond(100) + (assertion_bond(200) - fee(5)) = 295
    // but disputerStart was captured before spending the 100 bond → net change = 295 - 100 = 195
    expect(await balanceOf(connection, token.llmDisputerAta)).toBe(
      disputerStart + 195,
    );
  });

  it("llm path: disputer wrong (LLM says TRUE), asserter wins bonds", async () => {
    const a = ctx.newAssertion();
    const bond = 200;
    const asserterStart = await balanceOf(connection, token.asserterAta);

    await ctx.createAssertion(a, "SOL hits $1k", bond, "solana");
    await ctx.disputeAssertion(a);
    await ctx.submitMockLlmResolution(a, OUTCOME.TRUE);

    await sleep(6000);

    await ctx.finalizeLlmResolution(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.TRUE);

    // asserter correct: assertion_bond(200) + llm_bond(100) - fee(100*250/10000=2) = 298
    expect(await balanceOf(connection, token.asserterAta)).toBe(
      asserterStart + 98, // net: +100(llm bond recovered) - 2(fee) = +98
    );
  });

  // ── Full escalation (placeholder) ─────────────────────────────────────────

  it("escalation: placeholder resolves to FALSE, accounts settled", async () => {
    const a = ctx.newAssertion();

    await ctx.createAssertion(a, "Solana TPS > 10000", 500, "perf");
    await ctx.disputeAssertion(a);
    await ctx.submitMockLlmResolution(a, OUTCOME.TRUE);
    await ctx.challengeLlmResolution(a);
    await ctx.openVoteMock(a);

    let acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.VOTING);

    await sleep(7000); // past both voting and reveal windows

    await ctx.finalizeVoteResolutionPlaceholder(a, OUTCOME.FALSE);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.FALSE);
    expect(resolved.finalizedAt.toNumber()).toBeGreaterThan(0);

    const llmDisp = await ctx.fetchLlmDispute(a);
    expect(llmDisp.settlementResolution).not.toBe(OUTCOME.NONE);

    const voteDisp = await ctx.fetchVoteDispute(a);
    expect(voteDisp.settlementResolution).not.toBe(OUTCOME.NONE);

    const vr = await ctx.fetchVoteRound(a);
    expect(vr.finalOutcome).toBe(OUTCOME.FALSE);
  });

  // ── Existing error cases ──────────────────────────────────────────────────

  it("error: premature finalizeUndisputed", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Test", 200);

    await expect(ctx.finalizeUndisputed(a)).rejects.toThrow();
  });

  it("error: bond below minimum", async () => {
    const a = ctx.newAssertion();
    await expect(ctx.createAssertion(a, "Fail", 50)).rejects.toThrow();
  });

  it("error: disputing after liveness deadline", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Late dispute", 200);
    await sleep(3000);

    await expect(ctx.disputeAssertion(a)).rejects.toThrow();
  });

  it("error: submitMockLlmResolution when state is Asserted", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "No dispute", 200);

    await expect(ctx.submitMockLlmResolution(a, OUTCOME.TRUE)).rejects.toThrow();
  });

  it("error: challengeLlmResolution after challenge deadline", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Missed challenge", 200);
    await ctx.disputeAssertion(a);
    await ctx.submitMockLlmResolution(a, OUTCOME.TRUE);
    await sleep(6000); // past llm_challenge_window (3s)

    await expect(ctx.challengeLlmResolution(a)).rejects.toThrow();
  });

  it("error: double dispute rejected", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Double dispute", 200);
    await ctx.disputeAssertion(a);

    await expect(ctx.disputeAssertion(a)).rejects.toThrow();
  });

  it("error: mismatched llmDispute account in finalizeLlmResolution", async () => {
    const a1 = ctx.newAssertion();
    const a2 = ctx.newAssertion();

    await ctx.createAssertion(a1, "A1", 200, "a1");
    await ctx.disputeAssertion(a1);
    await ctx.createAssertion(a2, "A2", 200, "a2");

    await expect(
      program.methods
        .finalizeLlmResolution()
        .accounts({
          finalizer: provider.wallet.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion: a1.pdas.assertion,
          llmDispute: a2.pdas.llmDispute, // wrong dispute account
          llmResolutionRound: a1.pdas.llmRound,
          bondVault: a1.pdas.bondVault,
          asserterPusd: token.asserterAta,
          llmDisputerPusd: token.llmDisputerAta,
          treasuryPusd: proto.treasuryAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VOTING SYSTEM TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("voting: happy paths", () => {
    // bond=500 → assertion_bond=500, llm_bond=250, vote_bond=150
    // voter_reward_pool = 150 * 2500/10000 = 37

    it("single voter votes TRUE unanimously, claims full reward pool", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE); // LLM said TRUE

      const nonce = randomNonce();
      const hash = computeCommitHash(OUTCOME.TRUE, nonce);

      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash);

      const record = await ctx.fetchVoteRecord(a, token.voters[0]);
      expect(record.voter.toString()).toBe(token.voters[0].publicKey.toString());
      expect(record.opalWeight.toString()).toBe(
        VOTER_OPAL_AMOUNTS[0].toString(),
      );
      expect(record.revealed).toBe(0);

      await sleep(6000); // past voting_deadline (3s)

      await ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, nonce);

      const revealedRecord = await ctx.fetchVoteRecord(a, token.voters[0]);
      expect(revealedRecord.revealed).toBe(1);
      expect(revealedRecord.outcome).toBe(OUTCOME.TRUE);

      const vr = await ctx.fetchVoteRound(a);
      expect(vr.aggregateVotes.trueWeight.toString()).toBe(
        VOTER_OPAL_AMOUNTS[0].toString(),
      );
      expect(vr.totalValidWeight.toString()).toBe(VOTER_OPAL_AMOUNTS[0].toString());

      await sleep(6000); // past reveal_deadline (3s more)

      const asserterBefore = await balanceOf(connection, token.asserterAta);
      const vaultBefore = await balanceOf(
        connection,
        a.pdas.bondVault,
      );

      await ctx.finalizeVoteResolution(a);

      const resolved = await ctx.fetchAssertion(a);
      expect(resolved.state).toBe(STATE.RESOLVED);
      expect(resolved.outcome).toBe(OUTCOME.TRUE);

      const finalVr = await ctx.fetchVoteRound(a);
      expect(finalVr.finalOutcome).toBe(OUTCOME.TRUE);
      expect(finalVr.voterRewardPool.toNumber()).toBe(37);

      // Asserter wins Stage A (LLM wrong): stage_a_payout = 500 + 250 - fee(250*250/10000=6) = 744
      // Vote disputer wrong (voted TRUE confirmed): bonus = 150-37-3=110 to asserter
      // asserter total = 744 + 110 = 854
      expect(await balanceOf(connection, token.asserterAta)).toBe(
        asserterBefore + 854,
      );

      // voter_reward_pool = 37 stays in vault
      const voterBefore = await balanceOf(connection, token.voterPusdAtas[0]);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
      // Single voter → gets all 37
      expect(await balanceOf(connection, token.voterPusdAtas[0])).toBe(
        voterBefore + 37,
      );
    });

    it("two voters vote FALSE with supermajority, llmDisputer wins", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE); // LLM said TRUE, disputed

      const nonces = [randomNonce(), randomNonce()];
      // voter0 (3000 OPAL) and voter1 (2000 OPAL) both vote FALSE
      // FALSE weight = 5000 / 5000 = 100% ≥ 67% → FALSE wins
      for (let i = 0; i < 2; i++) {
        const hash = computeCommitHash(OUTCOME.FALSE, nonces[i]);
        await ctx.castVote(a, token.voters[i], token.voterOpalAtas[i], hash);
      }

      await sleep(6000);

      for (let i = 0; i < 2; i++) {
        await ctx.revealVote(a, token.voters[i], OUTCOME.FALSE, nonces[i]);
      }

      const vr = await ctx.fetchVoteRound(a);
      expect(vr.aggregateVotes.falseWeight.toString()).toBe("5000");
      expect(vr.aggregateVotes.trueWeight.toString()).toBe("0");

      await sleep(6000);

      const llmDisputerBefore = await balanceOf(connection, token.llmDisputerAta);
      await ctx.finalizeVoteResolution(a);

      const resolved = await ctx.fetchAssertion(a);
      expect(resolved.state).toBe(STATE.RESOLVED);
      expect(resolved.outcome).toBe(OUTCOME.FALSE);

      // LLM disputer wins Stage A: payout = 250 + 500 - fee(500*250/10000=12) = 738
      // Vote disputer wins Stage B: gets back 150-37-3=110
      expect(await balanceOf(connection, token.llmDisputerAta)).toBe(
        llmDisputerBefore + 738,
      );

      // Both voters voted FALSE → can claim proportional rewards
      const v0Before = await balanceOf(connection, token.voterPusdAtas[0]);
      const v1Before = await balanceOf(connection, token.voterPusdAtas[1]);

      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
      await ctx.claimVoteReward(a, token.voters[1], token.voterPusdAtas[1], token.voterOpalAtas[1]);

      // voter0: 37 * 3000/5000 = 22; voter1: 37 * 2000/5000 = 14 (integer truncation)
      expect(await balanceOf(connection, token.voterPusdAtas[0])).toBe(
        v0Before + 22,
      );
      expect(await balanceOf(connection, token.voterPusdAtas[1])).toBe(
        v1Before + 14,
      );
    });

    it("mixed votes with TRUE supermajority (80%), TRUE wins", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonces = [randomNonce(), randomNonce()];
      // voter0 (3000) TRUE, voter1 (2000) FALSE
      // TRUE=3000, FALSE=2000; TRUE=60% — NOT supermajority alone
      // Use voter0 (3000) + voter2 (1000) TRUE vs voter1 (2000) FALSE:
      // TRUE=4000/6000=66.7% — just under 67%... let me use only voter0 (3000) TRUE vs none
      // Actually: voter0 (3000) TRUE = 3000/3000 = 100% (only voter)
      // For a cleaner "supermajority" test with minority opposition:
      // voter0 (3000 OPAL) TRUE, voter2 (1000 OPAL) FALSE: TRUE=75% > 67% ✓
      const trueNonce = randomNonce();
      const falseNonce = randomNonce();
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.TRUE, trueNonce),
      );
      await ctx.castVote(
        a,
        token.voters[2],
        token.voterOpalAtas[2],
        computeCommitHash(OUTCOME.FALSE, falseNonce),
      );

      await sleep(6000);

      await ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, trueNonce);
      await ctx.revealVote(a, token.voters[2], OUTCOME.FALSE, falseNonce);

      // TRUE=3000, FALSE=1000, total=4000, TRUE=75% > 67%
      await sleep(6000);

      await ctx.finalizeVoteResolution(a);

      const resolved = await ctx.fetchAssertion(a);
      expect(resolved.outcome).toBe(OUTCOME.TRUE);

      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
      await ctx.claimVoteReward(a, token.voters[2], token.voterPusdAtas[2], token.voterOpalAtas[2]);
    });

    it("open_vote_mock transitions assertion to VOTING state", async () => {
      const a = ctx.newAssertion();
      await ctx.createAssertion(a, "State check", 500, "s");
      await ctx.disputeAssertion(a);
      await ctx.submitMockLlmResolution(a, OUTCOME.TRUE);
      await ctx.challengeLlmResolution(a);

      let acc = await ctx.fetchAssertion(a);
      expect(acc.state).toBe(STATE.PENDING_VOTE);

      await ctx.openVoteMock(a);

      acc = await ctx.fetchAssertion(a);
      expect(acc.state).toBe(STATE.VOTING);

      const vr = await ctx.fetchVoteRound(a);
      expect(vr.delegated).toBe(1);
      expect(vr.votingDeadline.toNumber()).toBeGreaterThan(0);
      expect(vr.revealDeadline.toNumber()).toBeGreaterThan(vr.votingDeadline.toNumber());
    });
  });

  describe("voting: unresolvable outcomes", () => {
    it("tie vote → UNRESOLVABLE outcome", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      // voter0 (3000) TRUE, voter1 (2000) FALSE, voter2 (1000) TRUE
      // TRUE=4000, FALSE=2000, TRUE=66.7% < 67% supermajority → UNRESOLVABLE
      // For exact tie: need TRUE_weight == FALSE_weight
      // Use voter1 (2000) TRUE + voter2 (1000) TRUE  = 3000 vs voter0 (3000) FALSE
      const nonces = [randomNonce(), randomNonce(), randomNonce()];
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.FALSE, nonces[0]),
      );
      await ctx.castVote(
        a,
        token.voters[1],
        token.voterOpalAtas[1],
        computeCommitHash(OUTCOME.TRUE, nonces[1]),
      );
      await ctx.castVote(
        a,
        token.voters[2],
        token.voterOpalAtas[2],
        computeCommitHash(OUTCOME.TRUE, nonces[2]),
      );

      await sleep(6000);

      await ctx.revealVote(a, token.voters[0], OUTCOME.FALSE, nonces[0]);
      await ctx.revealVote(a, token.voters[1], OUTCOME.TRUE, nonces[1]);
      await ctx.revealVote(a, token.voters[2], OUTCOME.TRUE, nonces[2]);

      // TRUE=3000, FALSE=3000 → TIE → UNRESOLVABLE
      await sleep(6000);

      await ctx.finalizeVoteResolution(a);

      const resolved = await ctx.fetchAssertion(a);
      expect(resolved.state).toBe(STATE.RESOLVED);
      expect(resolved.outcome).toBe(OUTCOME.UNRESOLVABLE);

      const finalVr = await ctx.fetchVoteRound(a);
      expect(finalVr.finalOutcome).toBe(OUTCOME.UNRESOLVABLE);

      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
      await ctx.claimVoteReward(a, token.voters[1], token.voterPusdAtas[1], token.voterOpalAtas[1]);
      await ctx.claimVoteReward(a, token.voters[2], token.voterPusdAtas[2], token.voterOpalAtas[2]);
    });

    it("no supermajority → UNRESOLVABLE (TRUE=60%, below 67% threshold)", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      // voter0 (3000) TRUE, voter1 (2000) FALSE
      // TRUE=3000/5000=60%, FALSE=2000/5000=40%
      // TRUE doesn't reach 67% supermajority
      const trueNonce = randomNonce();
      const falseNonce = randomNonce();
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.TRUE, trueNonce),
      );
      await ctx.castVote(
        a,
        token.voters[1],
        token.voterOpalAtas[1],
        computeCommitHash(OUTCOME.FALSE, falseNonce),
      );

      await sleep(6000);
      await ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, trueNonce);
      await ctx.revealVote(a, token.voters[1], OUTCOME.FALSE, falseNonce);

      await sleep(6000);

      await ctx.finalizeVoteResolution(a);

      const resolved = await ctx.fetchAssertion(a);
      expect(resolved.outcome).toBe(OUTCOME.UNRESOLVABLE);

      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
      await ctx.claimVoteReward(a, token.voters[1], token.voterPusdAtas[1], token.voterOpalAtas[1]);
    });

    it("zero reveals → quorum not met error", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.TRUE, nonce),
      );
      // Cast but never reveal — total_valid_weight stays 0

      await sleep(6000); // past voting_deadline
      // Do NOT call revealVote
      await sleep(6000); // past reveal_deadline

      // total_valid_weight = 0 < min_quorum_weight = 1 → QuorumNotMet
      await expect(ctx.finalizeVoteResolution(a)).rejects.toThrow();

      // Reveal deadline has passed — recover escrowed OPAL even without finalization.
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("UNRESOLVABLE outcome: voters reclaim escrowed OPAL (no PUSD, unresolvable bucket has no weight)", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      // Force UNRESOLVABLE via tie
      const n0 = randomNonce();
      const n1 = randomNonce();
      const n2 = randomNonce();
      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], computeCommitHash(OUTCOME.FALSE, n0));
      await ctx.castVote(a, token.voters[1], token.voterOpalAtas[1], computeCommitHash(OUTCOME.TRUE, n1));
      await ctx.castVote(a, token.voters[2], token.voterOpalAtas[2], computeCommitHash(OUTCOME.TRUE, n2));

      await sleep(6000);
      await ctx.revealVote(a, token.voters[0], OUTCOME.FALSE, n0);
      await ctx.revealVote(a, token.voters[1], OUTCOME.TRUE, n1);
      await ctx.revealVote(a, token.voters[2], OUTCOME.TRUE, n2);

      await sleep(6000);
      await ctx.finalizeVoteResolution(a);

      const finalVr = await ctx.fetchVoteRound(a);
      expect(finalVr.finalOutcome).toBe(OUTCOME.UNRESOLVABLE);

      // No one voted UNRESOLVABLE → winning bucket weight = 0 → no PUSD, but OPAL escrow returned
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
      await ctx.claimVoteReward(a, token.voters[1], token.voterPusdAtas[1], token.voterOpalAtas[1]);
      await ctx.claimVoteReward(a, token.voters[2], token.voterPusdAtas[2], token.voterOpalAtas[2]);
    });
  });

  describe("voting: cast_vote error cases", () => {
    it("error: cast_vote after commit window closed", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      await sleep(6000); // past voting_deadline (3s)

      const hash = computeCommitHash(OUTCOME.TRUE, randomNonce());
      await expect(
        ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash),
      ).rejects.toThrow();
    });

    it("error: same voter cannot cast_vote twice (PDA already exists)", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      const hash1 = computeCommitHash(OUTCOME.TRUE, nonce);
      const hash2 = computeCommitHash(OUTCOME.FALSE, randomNonce());

      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash1);

      await expect(
        ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash2),
      ).rejects.toThrow();

      // Cleanup: complete the cycle to return voter[0]'s escrowed OPAL.
      await sleep(6000);
      await ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, nonce);
      await sleep(6000);
      await ctx.finalizeVoteResolution(a);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("error: cast_vote with wrong OPAL mint", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const hash = computeCommitHash(OUTCOME.TRUE, randomNonce());
      // Pass the PUSD ATA (wrong mint) instead of OPAL ATA
      await expect(
        ctx.castVote(a, token.voters[0], token.voterPusdAtas[0], hash),
      ).rejects.toThrow();
    });

    it("error: open_vote_mock rejected when assertion not in PENDING_VOTE", async () => {
      const a = ctx.newAssertion();
      await ctx.createAssertion(a, "Not disputed", 500, "nd");
      // Assertion is ASSERTED, not PENDING_VOTE

      await expect(ctx.openVoteMock(a)).rejects.toThrow();
    });
  });

  describe("voting: reveal_vote error cases", () => {
    it("error: reveal_vote before voting_deadline", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      const hash = computeCommitHash(OUTCOME.TRUE, nonce);
      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash);

      // Try to reveal immediately — voting window is still open
      await expect(
        ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, nonce),
      ).rejects.toThrow();

      // Cleanup: wait past both windows, recover escrowed OPAL.
      await sleep(11000);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("error: reveal_vote after reveal_deadline", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      const hash = computeCommitHash(OUTCOME.TRUE, nonce);
      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash);

      await sleep(11000); // past both voting (5s) AND reveal (5s) windows

      await expect(
        ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, nonce),
      ).rejects.toThrow();

      // Reveal deadline already passed — recover escrowed OPAL.
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("error: reveal_vote with wrong nonce", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const correctNonce = randomNonce();
      const wrongNonce = randomNonce();
      const hash = computeCommitHash(OUTCOME.TRUE, correctNonce);
      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash);

      await sleep(6000);

      await expect(
        ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, wrongNonce),
      ).rejects.toThrow();

      await sleep(6000);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("error: reveal_vote with wrong outcome (hash mismatch)", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      const hash = computeCommitHash(OUTCOME.TRUE, nonce);
      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash);

      await sleep(6000);

      // Committed TRUE but trying to reveal as FALSE
      await expect(
        ctx.revealVote(a, token.voters[0], OUTCOME.FALSE, nonce),
      ).rejects.toThrow();

      await sleep(6000);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("error: reveal_vote twice for same voter", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      const hash = computeCommitHash(OUTCOME.TRUE, nonce);
      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash);

      await sleep(6000);
      await ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, nonce);

      // Second reveal attempt
      await expect(
        ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, nonce),
      ).rejects.toThrow();

      await sleep(6000);
      await ctx.finalizeVoteResolution(a);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("error: voter A cannot reveal voter B's vote", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      const hash = computeCommitHash(OUTCOME.TRUE, nonce);
      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash);

      await sleep(6000);

      // voter1 tries to reveal using voter0's VoteRecord seeds — PDA won't match
      const wrongVoteRecord = deriveVoteRecord(
        a.pdas.voteRound,
        token.voters[0].publicKey,
        program.programId,
      );
      await expect(
        program.methods
          .revealVote({ outcome: OUTCOME.TRUE, nonce: Array.from(nonce) })
          .accounts({
            voter: token.voters[1].publicKey, // different signer
            voteResolutionRound: a.pdas.voteRound,
            voteRecord: wrongVoteRecord,
          })
          .signers([token.voters[1]])
          .rpc({ commitment: "confirmed" }),
      ).rejects.toThrow();

      await sleep(6000);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });
  });

  describe("voting: finalize_vote_resolution error cases", () => {
    it("error: finalize before reveal_deadline", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.TRUE, nonce),
      );
      await sleep(6000); // past voting, in reveal window
      await ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, nonce);

      // Still in reveal window — should reject
      await expect(ctx.finalizeVoteResolution(a)).rejects.toThrow();

      // Cleanup: wait for reveal window to close, finalize, claim.
      await sleep(6000);
      await ctx.finalizeVoteResolution(a);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("error: finalize twice (already settled)", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.TRUE, nonce),
      );
      await sleep(6000);
      await ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, nonce);
      await sleep(6000);
      await ctx.finalizeVoteResolution(a);

      // Second call should fail
      await expect(ctx.finalizeVoteResolution(a)).rejects.toThrow();

      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("error: finalizeVoteResolution wrong assertion state", async () => {
      const a = ctx.newAssertion();
      // Create + dispute + llm resolve, but do NOT escalate to vote
      await ctx.createAssertion(a, "Not voting", 500, "nv");
      await ctx.disputeAssertion(a);
      await ctx.submitMockLlmResolution(a, OUTCOME.TRUE);
      // assertion is now in ASSERTED_LLM, not VOTING

      await expect(ctx.finalizeVoteResolution(a)).rejects.toThrow();
    });
  });

  describe("voting: claim_vote_reward error cases", () => {
    it("error: non-winning voter cannot claim reward", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      // voter0 (3000) TRUE + voter1 (2000) TRUE = 5000 TRUE vs voter2 (1000) FALSE
      // TRUE = 5000/6000 = 83.3% > 67% supermajority → TRUE wins
      const n0 = randomNonce();
      const n1 = randomNonce();
      const n2 = randomNonce();
      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], computeCommitHash(OUTCOME.TRUE, n0));
      await ctx.castVote(a, token.voters[1], token.voterOpalAtas[1], computeCommitHash(OUTCOME.TRUE, n1));
      await ctx.castVote(a, token.voters[2], token.voterOpalAtas[2], computeCommitHash(OUTCOME.FALSE, n2));

      await sleep(6000);
      await ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, n0);
      await ctx.revealVote(a, token.voters[1], OUTCOME.TRUE, n1);
      await ctx.revealVote(a, token.voters[2], OUTCOME.FALSE, n2);

      await sleep(6000);
      await ctx.finalizeVoteResolution(a);

      const resolved = await ctx.fetchAssertion(a);
      expect(resolved.outcome).toBe(OUTCOME.TRUE);

      // voter2 voted FALSE (wrong side) — gets OPAL back, no PUSD reward
      await ctx.claimVoteReward(a, token.voters[2], token.voterPusdAtas[2], token.voterOpalAtas[2]);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
      await ctx.claimVoteReward(a, token.voters[1], token.voterPusdAtas[1], token.voterOpalAtas[1]);
    });

    it("error: voter cannot claim twice", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.TRUE, nonce),
      );

      await sleep(6000);
      await ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, nonce);
      await sleep(6000);
      await ctx.finalizeVoteResolution(a);

      // First claim — succeeds
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);

      // Second claim — VoteRecord closed by `close = voter`, account gone
      await expect(
        ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]),
      ).rejects.toThrow();
    });

    it("error: voter who never revealed cannot claim", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      // voter0 commits but never reveals
      const nonce = randomNonce();
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.TRUE, nonce),
      );

      // voter1 commits and reveals — TRUE wins
      const nonce1 = randomNonce();
      await ctx.castVote(
        a,
        token.voters[1],
        token.voterOpalAtas[1],
        computeCommitHash(OUTCOME.TRUE, nonce1),
      );

      await sleep(6000);
      await ctx.revealVote(a, token.voters[1], OUTCOME.TRUE, nonce1);
      // voter0 does NOT reveal
      await sleep(6000);
      await ctx.finalizeVoteResolution(a);

      // voter0 never revealed → gets OPAL back, no PUSD reward
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
      await ctx.claimVoteReward(a, token.voters[1], token.voterPusdAtas[1], token.voterOpalAtas[1]);
    });

    it("error: claim before finalize_vote_resolution is called", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.TRUE, nonce),
      );
      // Try to claim immediately — reveal_deadline has not passed and round is not committed.
      await expect(
        ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]),
      ).rejects.toThrow();

      // Cleanup: wait past both windows, recover escrowed OPAL.
      await sleep(11000);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });
  });

  describe("voting: reward distribution precision", () => {
    it("proportional rewards: three voters with 3000/2000/1000 OPAL all voting TRUE", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonces = [randomNonce(), randomNonce(), randomNonce()];
      for (let i = 0; i < 3; i++) {
        await ctx.castVote(
          a,
          token.voters[i],
          token.voterOpalAtas[i],
          computeCommitHash(OUTCOME.TRUE, nonces[i]),
        );
      }

      await sleep(6000);
      for (let i = 0; i < 3; i++) {
        await ctx.revealVote(a, token.voters[i], OUTCOME.TRUE, nonces[i]);
      }

      await sleep(6000);
      await ctx.finalizeVoteResolution(a);

      const finalVr = await ctx.fetchVoteRound(a);
      expect(finalVr.voterRewardPool.toNumber()).toBe(37);
      // TRUE weight: 3000+2000+1000 = 6000

      const balancesBefore = await Promise.all(
        token.voterPusdAtas.map((ata) => balanceOf(connection, ata)),
      );

      for (let i = 0; i < 3; i++) {
        await ctx.claimVoteReward(a, token.voters[i]!, token.voterPusdAtas[i]!, token.voterOpalAtas[i]!);
      }

      const balancesAfter = await Promise.all(
        token.voterPusdAtas.map((ata) => balanceOf(connection, ata)),
      );

      const rewards = balancesAfter.map((b, i) => b - balancesBefore[i]);

      // voter0: 37 * 3000/6000 = 18 (floor)
      // voter1: 37 * 2000/6000 = 12 (floor)
      // voter2: 37 * 1000/6000 = 6  (floor)
      expect(rewards[0]).toBe(18);
      expect(rewards[1]).toBe(12);
      expect(rewards[2]).toBe(6);

      // Total paid = 36, 1 dust remains in vault — expected integer rounding
      expect(rewards[0] + rewards[1] + rewards[2]).toBe(36);
    });

    it("vote_dispute_correct: vote disputer gets bond back (minus voter pool and fee)", async () => {
      const a = ctx.newAssertion();
      // LLM says TRUE; vote_disputer challenged TRUE
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.FALSE, nonce), // vote says FALSE
      );

      await sleep(6000);
      await ctx.revealVote(a, token.voters[0], OUTCOME.FALSE, nonce);
      await sleep(6000);

      const voteDisputerBefore = await balanceOf(connection, token.voteDisputerAta);
      await ctx.finalizeVoteResolution(a);

      // vote_dispute_correct = (FALSE != TRUE) = true → disputer gets back bond
      // disputer_back = vote_bond(150) - voter_pool(37) - fee(3) = 110
      expect(await balanceOf(connection, token.voteDisputerAta)).toBe(
        voteDisputerBefore + 110,
      );

      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("treasury receives correct fee from both dispute stages", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.TRUE, nonce),
      );

      await sleep(6000);
      await ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, nonce);
      await sleep(6000);

      const treasuryBefore = await balanceOf(connection, proto.treasuryAta);
      await ctx.finalizeVoteResolution(a);

      // Stage A fee: llm_bond(250) * 250/10000 = 6
      // Stage B fee: vote_bond(150) * 250/10000 = 3
      // Total treasury fee = 9
      expect(await balanceOf(connection, proto.treasuryAta)).toBe(
        treasuryBefore + 9,
      );

      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });
  });

  describe("voting: undelegate_vote_round_mock", () => {
    it("succeeds after reveal window closes", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);
      await sleep(11000); // past both voting (5s) and reveal (5s) windows
      await ctx.undelegateVoteRoundMock(a);
    });

    it("error: rejected when reveal window has not closed yet", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);
      await sleep(6000); // past voting window, still inside reveal window
      await expect(ctx.undelegateVoteRoundMock(a)).rejects.toThrow();
    });

    it("error: rejected when assertion is not in VOTING state", async () => {
      const a = ctx.newAssertion();
      // Create through challenge so voteResolutionRound exists, but skip openVoteMock
      await ctx.createAssertion(a, "No open vote", 500, "nov");
      await ctx.disputeAssertion(a);
      await ctx.submitMockLlmResolution(a, OUTCOME.TRUE);
      await ctx.challengeLlmResolution(a);
      // Assertion is PENDING_VOTE, not VOTING
      await expect(ctx.undelegateVoteRoundMock(a)).rejects.toThrow();
    });
  });

  describe("voting: vote_record state integrity", () => {
    it("VoteRecord stores correct fields after cast_vote", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      const hash = computeCommitHash(OUTCOME.TRUE, nonce);
      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash);

      const record = await ctx.fetchVoteRecord(a, token.voters[0]);
      expect(record.voter.toString()).toBe(token.voters[0].publicKey.toString());
      expect(record.voteRound.toString()).toBe(a.pdas.voteRound.toString());
      expect(Buffer.from(record.commitHash).equals(Buffer.from(hash))).toBe(true);
      expect(record.opalWeight.toNumber()).toBe(VOTER_OPAL_AMOUNTS[0]);
      expect(record.revealed).toBe(0);
      expect(record.outcome).toBe(OUTCOME.NONE);
      expect(record.rewardClaimed).toBe(0);

      // Cleanup: wait past reveal_deadline, recover escrowed OPAL.
      await sleep(11000);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("VoteRecord updated correctly after reveal_vote", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      const hash = computeCommitHash(OUTCOME.FALSE, nonce);
      await ctx.castVote(a, token.voters[0], token.voterOpalAtas[0], hash);

      await sleep(6000);
      await ctx.revealVote(a, token.voters[0], OUTCOME.FALSE, nonce);

      const record = await ctx.fetchVoteRecord(a, token.voters[0]);
      expect(record.revealed).toBe(1);
      expect(record.outcome).toBe(OUTCOME.FALSE);
      expect(Buffer.from(record.nonce).equals(nonce)).toBe(true);

      // Cleanup: finalize and claim to return escrowed OPAL.
      await sleep(6000);
      await ctx.finalizeVoteResolution(a);
      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);
    });

    it("VoteRecord closed and rent refunded after claim", async () => {
      const a = ctx.newAssertion();
      await ctx.setupVoting(a, 500, OUTCOME.TRUE);

      const nonce = randomNonce();
      await ctx.castVote(
        a,
        token.voters[0],
        token.voterOpalAtas[0],
        computeCommitHash(OUTCOME.TRUE, nonce),
      );
      await sleep(6000);
      await ctx.revealVote(a, token.voters[0], OUTCOME.TRUE, nonce);
      await sleep(6000);
      await ctx.finalizeVoteResolution(a);

      const voterLamportsBefore = await connection.getBalance(
        token.voters[0].publicKey,
        "confirmed",
      );

      await ctx.claimVoteReward(a, token.voters[0], token.voterPusdAtas[0], token.voterOpalAtas[0]);

      // VoteRecord should no longer exist
      const voteRecordPk = deriveVoteRecord(
        a.pdas.voteRound,
        token.voters[0].publicKey,
        program.programId,
      );
      const accountInfo = await connection.getAccountInfo(voteRecordPk, "confirmed");
      expect(accountInfo).toBeNull();

      // Voter receives rent back (lamports should be higher)
      const voterLamportsAfter = await connection.getBalance(
        token.voters[0].publicKey,
        "confirmed",
      );
      expect(voterLamportsAfter).toBeGreaterThan(voterLamportsBefore);
    });
  });
});
