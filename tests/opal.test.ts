import { createHash, randomBytes } from "crypto";
import { describe, it, expect, beforeAll } from "bun:test";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
} from "@solana/spl-token";

import idl from "../target/idl/opal.json";
import type { Opal } from "../target/types/opal";

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
  COMMITTED_VOTE: Buffer.from("committed_vote"),
  VOTE_VAULT: Buffer.from("vote_vault"),
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
  NONE: 255,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fund(connection: Connection, pk: PublicKey, lamports: number) {
  const sig = await connection.requestAirdrop(pk, lamports);
  await connection.confirmTransaction(sig, "confirmed");
}

async function balanceOf(connection: Connection, ata: PublicKey) {
  const acc = await getAccount(connection, ata, "confirmed");
  return Number(acc.amount);
}

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
  const [voteVault] = PublicKey.findProgramAddressSync(
    [SEEDS.VOTE_VAULT, voteRound.toBuffer()],
    programId,
  );
  return { assertion, bondVault, llmDispute, llmRound, voteDispute, voteRound, voteVault };
}

type TokenEnv = {
  mint: PublicKey;
  mintAuthority: Keypair;
  treasury: Keypair;
  asserter: Keypair;
  asserterAta: PublicKey;
  llmDisputer: Keypair;
  llmDisputerAta: PublicKey;
  voteDisputer: Keypair;
  voteDisputerAta: PublicKey;
  voter1: Keypair;
  voter1Ata: PublicKey;
  voter2: Keypair;
  voter2Ata: PublicKey;
};

async function buildTokenEnv(connection: Connection): Promise<TokenEnv> {
  const mintAuthority = Keypair.generate();
  const treasury = Keypair.generate();
  const asserter = Keypair.generate();
  const llmDisputer = Keypair.generate();
  const voteDisputer = Keypair.generate();
  const voter1 = Keypair.generate();
  const voter2 = Keypair.generate();

  for (const kp of [
    mintAuthority,
    treasury,
    asserter,
    llmDisputer,
    voteDisputer,
    voter1,
    voter2,
  ]) {
    await fund(connection, kp.publicKey, 10_000_000_000);
  }

  const mint = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    6,
  );

  const atas = await Promise.all([
    getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, treasury.publicKey),
    getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, asserter.publicKey),
    getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, llmDisputer.publicKey),
    getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, voteDisputer.publicKey),
    getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, voter1.publicKey),
    getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, voter2.publicKey),
  ]);

  for (const acc of atas) {
    await mintTo(
      connection,
      mintAuthority,
      mint,
      acc.address,
      mintAuthority,
      1_000_000_000_000,
    );
  }

  return {
    mint,
    mintAuthority,
    treasury,
    asserter,
    asserterAta: atas[1].address,
    llmDisputer,
    llmDisputerAta: atas[2].address,
    voteDisputer,
    voteDisputerAta: atas[3].address,
    voter1,
    voter1Ata: atas[4].address,
    voter2,
    voter2Ata: atas[5].address,
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
      assertionBondMinPusd: new BN(100),
      llmDisputeBondRatioBps: 5000,
      voteDisputeBondRatioBps: 3000,
      protocolFeeBps: 250,
      llmDisputerRewardShareBps: 3000,
      voteDisputerRewardShareBps: 2500,
      voterRewardShareBps: 2500,
      treasuryShareBps: 2000,
      supermajorityBps: 6700,
      livenessWindowSeconds: new BN(2),
      llmChallengeWindowSeconds: new BN(3),
      voteSetupWindowSeconds: new BN(1),
      votingWindowSeconds: new BN(3),
      voteRevealWindowSeconds: new BN(5),
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

class Assertion {
  constructor(
    public id: PublicKey,
    public pdas: ReturnType<typeof derivePDAs>,
  ) {}
}

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

  async openVote(a: Assertion) {
    return this.program.methods
      .openVote()
      .accounts({
        authority: this.proto.authority.publicKey,
        protocolConfig: this.proto.configPda,
        pusdMint: this.token.mint,
        assertion: a.pdas.assertion,
        voteResolutionRound: a.pdas.voteRound,
        voteVault: a.pdas.voteVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.proto.authority])
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

  async configureLlmRound(
    a: Assertion,
    switchboardQueue: PublicKey,
    feedHash: Uint8Array,
    maxStalenessSlots: number,
  ) {
    return this.program.methods
      .configureLlmRound({
        switchboardQueue,
        switchboardFeedHash: Array.from(feedHash) as number[] & { length: 32 },
        maxStalenessSlots: new BN(maxStalenessSlots),
      })
      .accounts({
        authority: this.proto.authority.publicKey,
        protocolConfig: this.proto.configPda,
        assertion: a.pdas.assertion,
        llmResolutionRound: a.pdas.llmRound,
      })
      .signers([this.proto.authority])
      .rpc({ commitment: "confirmed" });
  }

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

  // Returns { salt, commitment } so the caller can reveal later
  async castVote(
    a: Assertion,
    voter: import("@solana/web3.js").Keypair,
    voterAta: PublicKey,
    outcome: number,
    bondAmount: number,
  ): Promise<{ salt: Buffer; commitment: Buffer }> {
    const salt = Buffer.from(randomBytes(32));
    const commitment = createHash("sha256")
      .update(Buffer.from([outcome]))
      .update(salt)
      .update(voter.publicKey.toBuffer())
      .digest();

    const [committedVote] = PublicKey.findProgramAddressSync(
      [SEEDS.COMMITTED_VOTE, a.pdas.voteRound.toBuffer(), voter.publicKey.toBuffer()],
      this.program.programId,
    );

    await this.program.methods
      .castVote({ commitment: Array.from(commitment) as number[] & { length: 32 }, bondAmount: new BN(bondAmount) })
      .accounts({
        voter: voter.publicKey,
        assertion: a.pdas.assertion,
        voteResolutionRound: a.pdas.voteRound,
        committedVote,
        voteVault: a.pdas.voteVault,
        voterPusd: voterAta,
        pusdMint: this.token.mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc({ commitment: "confirmed" });

    return { salt, commitment };
  }

  async revealVote(
    a: Assertion,
    voter: import("@solana/web3.js").Keypair,
    outcome: number,
    salt: Buffer,
  ) {
    const [committedVote] = PublicKey.findProgramAddressSync(
      [SEEDS.COMMITTED_VOTE, a.pdas.voteRound.toBuffer(), voter.publicKey.toBuffer()],
      this.program.programId,
    );

    return this.program.methods
      .revealVote({ outcome, salt: Array.from(salt) as number[] & { length: 32 } })
      .accounts({
        voter: voter.publicKey,
        assertion: a.pdas.assertion,
        voteResolutionRound: a.pdas.voteRound,
        committedVote,
      })
      .signers([voter])
      .rpc({ commitment: "confirmed" });
  }

  async finalizeVoteResolution(a: Assertion) {
    return this.program.methods
      .finalizeVoteResolution()
      .accounts({
        caller: this.provider.wallet.publicKey,
        protocolConfig: this.proto.configPda,
        pusdMint: this.token.mint,
        assertion: a.pdas.assertion,
        llmDispute: a.pdas.llmDispute,
        voteDispute: a.pdas.voteDispute,
        voteResolutionRound: a.pdas.voteRound,
        bondVault: a.pdas.bondVault,
        voteVault: a.pdas.voteVault,
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
    voter: import("@solana/web3.js").Keypair,
    voterAta: PublicKey,
  ) {
    const [committedVote] = PublicKey.findProgramAddressSync(
      [SEEDS.COMMITTED_VOTE, a.pdas.voteRound.toBuffer(), voter.publicKey.toBuffer()],
      this.program.programId,
    );

    return this.program.methods
      .claimVoteReward()
      .accounts({
        voter: voter.publicKey,
        assertion: a.pdas.assertion,
        voteResolutionRound: a.pdas.voteRound,
        committedVote,
        voteVault: a.pdas.voteVault,
        voterPusd: voterAta,
        pusdMint: this.token.mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([voter])
      .rpc({ commitment: "confirmed" });
  }

  // ── Voting setup helper ────────────────────────────────────────────────────
  // Escalates a fresh assertion all the way to VOTING state.
  async escalateToVoting(statement: string, bond: number): Promise<Assertion> {
    const a = this.newAssertion();
    await this.createAssertion(a, statement, bond);
    await this.disputeAssertion(a);
    await this.submitMockLlmResolution(a, 0);
    await this.challengeLlmResolution(a);
    await this.openVote(a);
    return a;
  }
}

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
    // Anchor only uses provider.opts when rpc() is called with no options.
    // Patch sendAndConfirm so skipPreflight is always injected regardless of
    // per-call opts — prevents "Blockhash not found" on a long-running validator.
    const _sendAndConfirm = provider.sendAndConfirm.bind(provider);
    provider.sendAndConfirm = (tx, signers, opts) =>
      _sendAndConfirm(tx, signers, { skipPreflight: true, ...opts });
    connection = provider.connection;
    program = anchor.workspace.Opal as Program<Opal>;
    token = await buildTokenEnv(connection);
  });

  it("rejects invalid protocol config", async () => {
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
          assertionBondMinPusd: new BN(0),
          llmDisputeBondRatioBps: 5000,
          voteDisputeBondRatioBps: 3000,
          protocolFeeBps: 250,
          llmDisputerRewardShareBps: 3000,
          voteDisputerRewardShareBps: 2500,
          voterRewardShareBps: 2500,
          treasuryShareBps: 2000,
          supermajorityBps: 6700,
          livenessWindowSeconds: new BN(86400),
          llmChallengeWindowSeconds: new BN(43200),
          voteSetupWindowSeconds: new BN(3600),
          votingWindowSeconds: new BN(86400),
          voteRevealWindowSeconds: new BN(86400),
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

  it("error: protocol config with zero liveness window", async () => {
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
          assertionBondMinPusd: new BN(100),
          llmDisputeBondRatioBps: 5000,
          voteDisputeBondRatioBps: 3000,
          protocolFeeBps: 250,
          llmDisputerRewardShareBps: 3000,
          voteDisputerRewardShareBps: 2500,
          voterRewardShareBps: 2500,
          treasuryShareBps: 2000,
          supermajorityBps: 6700,
          livenessWindowSeconds: new BN(0), // zero — must be > 0
          llmChallengeWindowSeconds: new BN(3),
          voteSetupWindowSeconds: new BN(1),
          votingWindowSeconds: new BN(3),
          voteRevealWindowSeconds: new BN(5),
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

  it("error: protocol config with supermajority at or below 50%", async () => {
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
          assertionBondMinPusd: new BN(100),
          llmDisputeBondRatioBps: 5000,
          voteDisputeBondRatioBps: 3000,
          protocolFeeBps: 250,
          llmDisputerRewardShareBps: 3000,
          voteDisputerRewardShareBps: 2500,
          voterRewardShareBps: 2500,
          treasuryShareBps: 2000,
          supermajorityBps: 5000, // exactly 50% — must be > 5000
          livenessWindowSeconds: new BN(2),
          llmChallengeWindowSeconds: new BN(3),
          voteSetupWindowSeconds: new BN(1),
          votingWindowSeconds: new BN(3),
          voteRevealWindowSeconds: new BN(5),
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

  it("error: protocol config with total reward shares exceeding 10000", async () => {
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

    // 3000 + 2500 + 2500 + 2001 = 10001 > 10000 — must fail
    await expect(
      program.methods
        .initializeProtocolConfig({
          assertionBondMinPusd: new BN(100),
          llmDisputeBondRatioBps: 5000,
          voteDisputeBondRatioBps: 3000,
          protocolFeeBps: 250,
          llmDisputerRewardShareBps: 3000,
          voteDisputerRewardShareBps: 2500,
          voterRewardShareBps: 2500,
          treasuryShareBps: 2001, // sum = 10001
          supermajorityBps: 6700,
          livenessWindowSeconds: new BN(2),
          llmChallengeWindowSeconds: new BN(3),
          voteSetupWindowSeconds: new BN(1),
          votingWindowSeconds: new BN(3),
          voteRevealWindowSeconds: new BN(5),
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

  it("initializes protocol", async () => {
    proto = await setupProtocol(program, token, provider.wallet.payer);
    ctx = new TestContext(program, provider, connection, token, proto);
  });

  it("undisputed path: creates, waits, finalizes with correct payouts", async () => {
    const a = ctx.newAssertion();
    const bond = 200;
    const asserterStart = await balanceOf(connection, token.asserterAta);
    const treasuryStart = await balanceOf(connection, proto.treasuryAta);

    await ctx.createAssertion(a, "Bitcoin > $100k by 2026", bond, "hash123");

    const acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.ASSERTED);
    expect(acc.disputeCount).toBe(0);
    expect(acc.outcome).toBe(OUTCOME.NONE);

    await sleep(4000);

    await ctx.finalizeUndisputed(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.TRUE);
    expect(resolved.finalizedAt.toNumber()).toBeGreaterThan(0);

    // fee = 200 * 250 / 10000 = 5
    expect(await balanceOf(connection, token.asserterAta)).toBe(
      asserterStart - bond + (bond - 5),
    );
    expect(await balanceOf(connection, proto.treasuryAta)).toBe(
      treasuryStart + 5,
    );
  });

  it("llm resolution path: disputes, resolves via llm, pays winner", async () => {
    const a = ctx.newAssertion();
    const bond = 200;

    await ctx.createAssertion(a, "ETH flips BTC", bond, "abc");

    const disputerStart = await balanceOf(connection, token.llmDisputerAta);

    await ctx.disputeAssertion(a);

    let acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.PENDING_LLM);
    expect(acc.disputeCount).toBe(1);

    await ctx.submitMockLlmResolution(a, 1);

    acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.ASSERTED_LLM);

    const round = await ctx.fetchLlmRound(a);
    expect(round.outcome).toBe(OUTCOME.FALSE);
    expect(round.challengeDeadline.toNumber()).toBeGreaterThan(0);

    await sleep(4000);

    await ctx.finalizeLlmResolution(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.FALSE);

    const dispute = await ctx.fetchLlmDispute(a);
    expect(dispute.settlementResolution).toBe(OUTCOME.FALSE);

    // disputer was correct (outcome != TRUE). Net gain = assertion bond - fee = 195.
    expect(await balanceOf(connection, token.llmDisputerAta)).toBe(
      disputerStart + 195,
    );
  });

  it("full escalation path: escalates to vote and resolves", async () => {
    const a = ctx.newAssertion();

    await ctx.createAssertion(a, "Solana TPS > 10000", 500, "perf");
    await ctx.disputeAssertion(a);
    await ctx.submitMockLlmResolution(a, 0);
    await ctx.challengeLlmResolution(a);
    await ctx.openVote(a);

    let acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.VOTING);

    await sleep(5000);

    // sanity-check accounts exist before calling finalize
    await ctx.fetchVoteDispute(a);
    await ctx.fetchVoteRound(a);

    await ctx.finalizeVoteResolutionPlaceholder(a, 1);

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

  it("error: premature finalizeUndisputed", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Test", 200);

    await expect(ctx.finalizeUndisputed(a)).rejects.toThrow();
  });

  it("error: insufficient bond", async () => {
    const a = ctx.newAssertion();
    await expect(
      ctx.createAssertion(a, "Fail", 50),
    ).rejects.toThrow();
  });

  it("error: disputing after liveness deadline", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Late dispute", 200);
    await sleep(4000);

    await expect(ctx.disputeAssertion(a)).rejects.toThrow();
  });

  it("error: submitMockLlmResolution when state is Asserted", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "No dispute", 200);

    await expect(
      ctx.submitMockLlmResolution(a, 0),
    ).rejects.toThrow();
  });

  it("error: challengeLlmResolution after challenge deadline", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Missed challenge", 200);
    await ctx.disputeAssertion(a);
    await ctx.submitMockLlmResolution(a, 0);
    await sleep(4000);

    await expect(ctx.challengeLlmResolution(a)).rejects.toThrow();
  });

  it("error: disputing an already-disputed assertion", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Double dispute", 200);
    await ctx.disputeAssertion(a);

    await expect(ctx.disputeAssertion(a)).rejects.toThrow();
  });

  it("configure_llm_round: stores oracle params on the round", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "BTC > $200k by 2027", 200);
    await ctx.disputeAssertion(a);

    const queue = Keypair.generate().publicKey;
    const feedHash = new Uint8Array(32).fill(0xab);

    await ctx.configureLlmRound(a, queue, feedHash, 250);

    const round = await ctx.fetchLlmRound(a);
    expect(round.switchboardQueue.toBase58()).toBe(queue.toBase58());
    expect(round.maxStalenessSlots.toNumber()).toBe(250);
    expect(Buffer.from(round.switchboardFeedHash as Buffer).toString("hex")).toBe(
      Buffer.from(feedHash).toString("hex"),
    );
  });

  it("configure_llm_round: can be updated by authority", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "ETH > $10k by 2026", 200);
    await ctx.disputeAssertion(a);

    const queue1 = Keypair.generate().publicKey;
    const queue2 = Keypair.generate().publicKey;
    const feedHash = new Uint8Array(32).fill(0x01);

    await ctx.configureLlmRound(a, queue1, feedHash, 100);
    await ctx.configureLlmRound(a, queue2, feedHash, 300);

    const round = await ctx.fetchLlmRound(a);
    expect(round.switchboardQueue.toBase58()).toBe(queue2.toBase58());
    expect(round.maxStalenessSlots.toNumber()).toBe(300);
  });

  it("error: configureLlmRound rejects non-authority caller", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "SOL > $1k", 200);
    await ctx.disputeAssertion(a);

    const impostor = Keypair.generate();
    await fund(connection, impostor.publicKey, 1_000_000_000);

    await expect(
      program.methods
        .configureLlmRound({
          switchboardQueue: Keypair.generate().publicKey,
          switchboardFeedHash: Array.from(new Uint8Array(32)) as number[] & { length: 32 },
          maxStalenessSlots: new BN(250),
        })
        .accounts({
          authority: impostor.publicKey,
          protocolConfig: proto.configPda,
          assertion: a.pdas.assertion,
          llmResolutionRound: a.pdas.llmRound,
        })
        .signers([impostor])
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow();
  });

  it("error: configureLlmRound rejects wrong state (not disputed)", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "State check", 200);
    // assertion is ASSERTED, not PENDING_LLM

    await expect(
      ctx.configureLlmRound(a, Keypair.generate().publicKey, new Uint8Array(32), 250),
    ).rejects.toThrow();
  });

  it("error: submitLlmResolution rejects wrong state (not disputed)", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "No dispute here", 200);
    // assertion is ASSERTED, not PENDING_LLM

    await expect(
      program.methods
        .submitLlmResolution({
          promptHash: Array.from(new Uint8Array(32)) as number[] & { length: 32 },
        })
        .accounts({
          submitter: provider.wallet.publicKey,
          protocolConfig: proto.configPda,
          assertion: a.pdas.assertion,
          llmResolutionRound: a.pdas.llmRound,
          switchboardQueue: Keypair.generate().publicKey,
          instructions: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
        })
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow();
  });

  it("error: submitLlmResolution rejects mismatched queue", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Queue mismatch test", 200);
    await ctx.disputeAssertion(a);

    const configuredQueue = Keypair.generate().publicKey;
    await ctx.configureLlmRound(a, configuredQueue, new Uint8Array(32).fill(1), 250);

    const wrongQueue = Keypair.generate().publicKey;

    await expect(
      program.methods
        .submitLlmResolution({
          promptHash: Array.from(new Uint8Array(32)) as number[] & { length: 32 },
        })
        .accounts({
          submitter: provider.wallet.publicKey,
          protocolConfig: proto.configPda,
          assertion: a.pdas.assertion,
          llmResolutionRound: a.pdas.llmRound,
          switchboardQueue: wrongQueue,
          instructions: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
        })
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow();
  });

  it("error: submitLlmResolution rejects missing sigVerify instruction", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "No oracle proof", 200);
    await ctx.disputeAssertion(a);

    const queue = Keypair.generate().publicKey;
    await ctx.configureLlmRound(a, queue, new Uint8Array(32).fill(2), 250);

    // queue matches but no sigVerify instruction at ix[0] — QuoteVerifier should reject
    await expect(
      program.methods
        .submitLlmResolution({
          promptHash: Array.from(new Uint8Array(32)) as number[] & { length: 32 },
        })
        .accounts({
          submitter: provider.wallet.publicKey,
          protocolConfig: proto.configPda,
          assertion: a.pdas.assertion,
          llmResolutionRound: a.pdas.llmRound,
          switchboardQueue: queue,
          instructions: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
        })
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow();
  });

  // ── Voting path ──────────────────────────────────────────────────────────

  it("voting path: cast, reveal, finalize, claim reward", async () => {
    const a = await ctx.escalateToVoting("SOL TPS > 50000 by 2025", 500);

    let acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.VOTING);

    const v1Start = await balanceOf(connection, token.voter1Ata);
    const v2Start = await balanceOf(connection, token.voter2Ata);

    // Wait for voting_starts_at (1s setup window)
    await sleep(1500);

    // Both voters vote FALSE (outcome=1)
    const { salt: salt1 } = await ctx.castVote(a, token.voter1, token.voter1Ata, 1, 100);
    const { salt: salt2 } = await ctx.castVote(a, token.voter2, token.voter2Ata, 1, 200);

    const voteRoundAfterCast = await ctx.fetchVoteRound(a);
    expect(Number(voteRoundAfterCast.totalVoteBond)).toBe(300);

    // Wait for voting_deadline (3s voting window)
    await sleep(3500);

    // Reveal both votes within the 5s reveal window
    await ctx.revealVote(a, token.voter1, 1, salt1);
    await ctx.revealVote(a, token.voter2, 1, salt2);

    const voteRoundAfterReveal = await ctx.fetchVoteRound(a);
    expect(Number(voteRoundAfterReveal.totalValidWeight)).toBe(300);
    expect(Number(voteRoundAfterReveal.aggregateVotes.falseWeight)).toBe(300);

    // Wait for reveal_deadline (5s reveal window — needs to expire before finalize)
    await sleep(5500);

    // Finalize — supermajority is 300/300 = 100% > 67%
    await ctx.finalizeVoteResolution(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.FALSE);

    const vr = await ctx.fetchVoteRound(a);
    expect(vr.finalOutcome).toBe(OUTCOME.FALSE);

    // Claim rewards (both are majority voters)
    await ctx.claimVoteReward(a, token.voter1, token.voter1Ata);
    await ctx.claimVoteReward(a, token.voter2, token.voter2Ata);

    // voter1 bond=100, voter2 bond=200; both voted with the majority
    const v1End = await balanceOf(connection, token.voter1Ata);
    const v2End = await balanceOf(connection, token.voter2Ata);
    expect(v1End).toBeGreaterThanOrEqual(v1Start - 100);
    expect(v2End).toBeGreaterThanOrEqual(v2Start - 200);

    // Double-claim must fail (VoteRewardAlreadyClaimed)
    await expect(
      ctx.claimVoteReward(a, token.voter1, token.voter1Ata),
    ).rejects.toThrow();
  });

  it("error: castVote when vote round not in Voting state", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "State check vote", 200);
    await ctx.disputeAssertion(a);
    await ctx.submitMockLlmResolution(a, 0);
    await ctx.challengeLlmResolution(a);
    // openVote NOT called — state is PENDING_VOTE, not VOTING
    await expect(
      ctx.castVote(a, token.voter1, token.voter1Ata, 1, 50),
    ).rejects.toThrow();
  });

  it("error: castVote after voting_deadline", async () => {
    const a = await ctx.escalateToVoting("Late vote test", 200);
    // Wait past voting_deadline (setup 1s + voting 3s = 4s)
    await sleep(5000);
    await expect(
      ctx.castVote(a, token.voter1, token.voter1Ata, 1, 50),
    ).rejects.toThrow();
  });

  it("error: revealVote with wrong commitment", async () => {
    const a = await ctx.escalateToVoting("Wrong reveal test", 200);

    await sleep(1500); // wait for voting_starts_at
    await ctx.castVote(a, token.voter1, token.voter1Ata, 1, 50);
    await sleep(3500); // wait for voting_deadline

    // Reveal with wrong outcome (committed 1, revealing with a random salt — hash won't match)
    const fakeSalt = Buffer.from(randomBytes(32));
    await expect(
      ctx.revealVote(a, token.voter1, 0, fakeSalt),
    ).rejects.toThrow();
  });

  it("error: finalizeVoteResolution before reveal_deadline", async () => {
    const a = await ctx.escalateToVoting("Premature finalize test", 200);

    await sleep(1500);
    const { salt: s1 } = await ctx.castVote(a, token.voter1, token.voter1Ata, 1, 50);
    // Wait for voting_deadline but NOT reveal_deadline (5s window starts after voting ends)
    await sleep(3500);
    await ctx.revealVote(a, token.voter1, 1, s1);
    // Still within the 5s reveal window — finalize must fail
    await expect(ctx.finalizeVoteResolution(a)).rejects.toThrow();
  });

  it("error: claimVoteReward for minority voter", async () => {
    const a = await ctx.escalateToVoting("Minority claim test", 500);

    await sleep(1500);
    // voter1 votes FALSE (majority), voter2 votes TRUE (minority)
    const { salt: salt1 } = await ctx.castVote(a, token.voter1, token.voter1Ata, 1, 300);
    const { salt: salt2 } = await ctx.castVote(a, token.voter2, token.voter2Ata, 0, 100);
    await sleep(3500);
    await ctx.revealVote(a, token.voter1, 1, salt1);
    await ctx.revealVote(a, token.voter2, 0, salt2);
    await sleep(5500);
    await ctx.finalizeVoteResolution(a);

    // voter2 voted TRUE which lost — claim should fail (VoterNotMajority)
    await expect(
      ctx.claimVoteReward(a, token.voter2, token.voter2Ata),
    ).rejects.toThrow();
  });

  it("error: revealVote after reveal_deadline", async () => {
    const a = await ctx.escalateToVoting("Reveal deadline test", 200);

    await sleep(1500);
    const { salt: s1 } = await ctx.castVote(a, token.voter1, token.voter1Ata, 1, 50);
    // Wait past both voting_deadline (3s) AND reveal_deadline (5s) = 8s total after voting_starts_at
    await sleep(9500);

    // Reveal window has closed — should fail (RevealWindowClosed)
    await expect(ctx.revealVote(a, token.voter1, 1, s1)).rejects.toThrow();
  });

  it("error: mismatched llmDispute account", async () => {
    const a1 = ctx.newAssertion();
    const a2 = ctx.newAssertion();

    // create and dispute assertion1
    await ctx.createAssertion(a1, "A1", 200, "a1");
    await ctx.disputeAssertion(a1);

    // create assertion2 (undisputed) so we can try to pass its dispute for assertion1
    await ctx.createAssertion(a2, "A2", 200, "a2");

    // finalizeLlmResolution with assertion1 but llmDispute from assertion2
    // should fail because the dispute doesn't link back to assertion1
    await expect(
      program.methods
        .finalizeLlmResolution()
        .accounts({
          finalizer: provider.wallet.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion: a1.pdas.assertion,
          llmDispute: a2.pdas.llmDispute,
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

  // ── Assertion validation ─────────────────────────────────────────────────

  it("error: createAssertion with statement too long (> 280 chars)", async () => {
    const a = ctx.newAssertion();
    const tooLong = "x".repeat(281);
    await expect(ctx.createAssertion(a, tooLong, 200)).rejects.toThrow();
  });

  it("error: createAssertion with auxiliary hash too long (> 128 chars)", async () => {
    const a = ctx.newAssertion();
    const tooLong = "h".repeat(129);
    await expect(ctx.createAssertion(a, "Valid statement", 200, tooLong)).rejects.toThrow();
  });

  it("createAssertion at exact minimum bond (100)", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Exact minimum bond", 100);
    const acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.ASSERTED);
    expect(Number(acc.assertionBondAmountPusd)).toBe(100);
  });

  it("error: finalizeUndisputed on a disputed assertion", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Disputed", 200);
    await ctx.disputeAssertion(a);
    // Assertion is now PENDING_LLM — finalizeUndisputed must fail
    await expect(ctx.finalizeUndisputed(a)).rejects.toThrow();
  });

  // ── LLM resolution edge cases ────────────────────────────────────────────

  it("llm resolution: asserter wins when LLM returns TRUE with correct payout", async () => {
    const a = ctx.newAssertion();
    const bond = 200;
    const asserterStart = await balanceOf(connection, token.asserterAta);
    const llmDisputerStart = await balanceOf(connection, token.llmDisputerAta);

    await ctx.createAssertion(a, "BTC hits $200k in 2026", bond);
    await ctx.disputeAssertion(a);
    await ctx.submitMockLlmResolution(a, 0); // LLM says TRUE
    // Wait for challenge window (3s)
    await sleep(4000);
    await ctx.finalizeLlmResolution(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.TRUE);

    const dispute = await ctx.fetchLlmDispute(a);
    expect(dispute.settlementResolution).toBe(OUTCOME.TRUE);

    // asserter wins: payout = assertion_bond + llm_bond - fee
    // llm_bond = 200 * 5000/10000 = 100; fee = 100 * 250/10000 = 2
    // asserter net gain = +98
    const asserterEnd = await balanceOf(connection, token.asserterAta);
    expect(asserterEnd).toBe(asserterStart + 98);

    // llm disputer loses their bond (gets 0 back)
    const llmDisputerEnd = await balanceOf(connection, token.llmDisputerAta);
    expect(llmDisputerEnd).toBe(llmDisputerStart - 100);
  });

  it("llm resolution: UNRESOLVABLE outcome settles correctly", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Will quantum computing solve P=NP by 2030?", 200);
    await ctx.disputeAssertion(a);
    await ctx.submitMockLlmResolution(a, 3); // UNRESOLVABLE

    const round = await ctx.fetchLlmRound(a);
    expect(round.outcome).toBe(3); // OUTCOME_UNRESOLVABLE

    await sleep(4000);
    await ctx.finalizeLlmResolution(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(3);
  });

  it("error: finalizeLlmResolution before challenge deadline", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Too early to finalize", 200);
    await ctx.disputeAssertion(a);
    await ctx.submitMockLlmResolution(a, 1);
    // Challenge window is 3s — try to finalize immediately without waiting
    await expect(ctx.finalizeLlmResolution(a)).rejects.toThrow();
  });

  it("error: submitMockLlmResolution by non-authority", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Non-authority resolution", 200);
    await ctx.disputeAssertion(a);

    const impostor = Keypair.generate();
    await fund(connection, impostor.publicKey, 1_000_000_000);

    await expect(
      program.methods
        .submitMockLlmResolution({ outcomeCode: 1 })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .accounts({
          authority: impostor.publicKey,
          assertion: a.pdas.assertion,
          llmResolutionRound: a.pdas.llmRound,
        } as any)
        .signers([impostor])
        .rpc({ commitment: "confirmed" }),
    ).rejects.toThrow();
  });

  it("error: finalizeLlmResolution when already settled (double finalize)", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Double finalize LLM test", 200);
    await ctx.disputeAssertion(a);
    await ctx.submitMockLlmResolution(a, 1);
    await sleep(4000);
    await ctx.finalizeLlmResolution(a); // first — succeeds

    // Second finalize must fail (AlreadySettled)
    await expect(ctx.finalizeLlmResolution(a)).rejects.toThrow();
  });

  // ── Vote edge cases ──────────────────────────────────────────────────────

  it("error: openVote when assertion is not in PENDING_VOTE state", async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, "Open vote wrong state", 200);
    // State is ASSERTED, not PENDING_VOTE
    await expect(ctx.openVote(a)).rejects.toThrow();
  });

  it("error: revealVote when already revealed (double reveal)", async () => {
    const a = await ctx.escalateToVoting("Double reveal test", 200);

    await sleep(1500);
    const { salt: s1 } = await ctx.castVote(a, token.voter1, token.voter1Ata, 1, 50);
    await sleep(3500); // past voting_deadline, within reveal window

    await ctx.revealVote(a, token.voter1, 1, s1); // first reveal — succeeds
    // Second reveal must fail (AlreadySettled)
    await expect(ctx.revealVote(a, token.voter1, 1, s1)).rejects.toThrow();
  });

  it("error: claimVoteReward when voter did not reveal", async () => {
    const a = await ctx.escalateToVoting("Unrevealed claim test", 200);

    await sleep(1500);
    // voter1 commits but never reveals; voter2 commits and reveals to enable finalization
    await ctx.castVote(a, token.voter1, token.voter1Ata, 1, 50);
    const { salt: s2 } = await ctx.castVote(a, token.voter2, token.voter2Ata, 1, 150);
    await sleep(3500);
    await ctx.revealVote(a, token.voter2, 1, s2); // only voter2 reveals
    await sleep(5500);
    await ctx.finalizeVoteResolution(a);

    // voter1 never revealed — claim must fail (VoteNotRevealed)
    await expect(
      ctx.claimVoteReward(a, token.voter1, token.voter1Ata),
    ).rejects.toThrow();
  });

  it("error: claimVoteReward before round is finalized", async () => {
    const a = await ctx.escalateToVoting("Claim before finalize test", 200);

    await sleep(1500);
    const { salt: s1 } = await ctx.castVote(a, token.voter1, token.voter1Ata, 1, 100);
    await sleep(3500);
    await ctx.revealVote(a, token.voter1, 1, s1);
    // Do NOT finalize — try to claim immediately (VoteNotFinalized)
    await expect(
      ctx.claimVoteReward(a, token.voter1, token.voter1Ata),
    ).rejects.toThrow();
  });

  it("error: double finalizeVoteResolution (AlreadySettled)", async () => {
    const a = await ctx.escalateToVoting("Double finalize vote test", 200);

    await sleep(1500);
    const { salt: s1 } = await ctx.castVote(a, token.voter1, token.voter1Ata, 1, 100);
    await sleep(3500);
    await ctx.revealVote(a, token.voter1, 1, s1);
    await sleep(5500);
    await ctx.finalizeVoteResolution(a); // first — succeeds

    // Second finalize must fail (AlreadySettled)
    await expect(ctx.finalizeVoteResolution(a)).rejects.toThrow();
  });

  it("vote path: no votes cast → UNRESOLVABLE outcome", async () => {
    const a = await ctx.escalateToVoting("No one votes test", 200);

    // Nobody casts a vote. Wait for setup (1s) + voting (3s) + reveal (5s) windows to all expire.
    await sleep(10_500);

    await ctx.finalizeVoteResolution(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(3); // OUTCOME_UNRESOLVABLE — total_valid_weight == 0

    const vr = await ctx.fetchVoteRound(a);
    expect(vr.finalOutcome).toBe(3);
    expect(Number(vr.totalValidWeight)).toBe(0);
  });

  it("vote path: voters say TRUE → asserter wins with correct payouts", async () => {
    // escalateToVoting submits LLM result = TRUE (0), then vote disputer challenges it
    const bond = 500;

    // Capture balances BEFORE escalation so bond deductions are included in the baseline.
    const asserterStart = await balanceOf(connection, token.asserterAta);
    const llmDisputerStart = await balanceOf(connection, token.llmDisputerAta);
    const voteDisputerStart = await balanceOf(connection, token.voteDisputerAta);
    const v1Start = await balanceOf(connection, token.voter1Ata);
    const v2Start = await balanceOf(connection, token.voter2Ata);

    const a = await ctx.escalateToVoting("Asserter vindicated by vote", bond);

    await sleep(1500); // wait for voting_starts_at
    // Both voters vote TRUE (outcome 0)
    const { salt: salt1 } = await ctx.castVote(a, token.voter1, token.voter1Ata, 0, 100);
    const { salt: salt2 } = await ctx.castVote(a, token.voter2, token.voter2Ata, 0, 200);
    await sleep(3500); // past voting_deadline
    await ctx.revealVote(a, token.voter1, 0, salt1);
    await ctx.revealVote(a, token.voter2, 0, salt2);
    await sleep(5500); // past reveal_deadline

    await ctx.finalizeVoteResolution(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.TRUE);

    // Stage A: asserter wins (LLM said TRUE, vote confirms TRUE → llm_dispute_correct = false)
    // llm_bond = 500 * 5000/10000 = 250; fee = 250 * 250/10000 = 6
    // asserter_payout_stage_a = 500 + (250 - 6) = 744
    //
    // Stage B: vote_disputer loses (vote confirms LLM → vote_dispute_correct = false)
    // vote_bond = 500 * 3000/10000 = 150; fee = 150 * 250/10000 = 3; bonus = 147
    // asserter_payout_total = 744 + 147 = 891
    //
    // asserter net = 891 - 500 = +391
    const asserterEnd = await balanceOf(connection, token.asserterAta);
    expect(asserterEnd).toBe(asserterStart + 391);

    // LLM disputer loses entire bond (250)
    const llmDisputerEnd = await balanceOf(connection, token.llmDisputerAta);
    expect(llmDisputerEnd).toBe(llmDisputerStart - 250);

    // Vote disputer loses entire bond (150)
    const voteDisputerEnd = await balanceOf(connection, token.voteDisputerAta);
    expect(voteDisputerEnd).toBe(voteDisputerStart - 150);

    // Voters are majority — claim bonds back (no slash since majority_bond = total_vote_bond)
    await ctx.claimVoteReward(a, token.voter1, token.voter1Ata);
    await ctx.claimVoteReward(a, token.voter2, token.voter2Ata);

    const v1End = await balanceOf(connection, token.voter1Ata);
    const v2End = await balanceOf(connection, token.voter2Ata);
    // slashed = 300 - 300 = 0, so voters get their exact bond back
    expect(v1End).toBe(v1Start);
    expect(v2End).toBe(v2Start);
  });
});
