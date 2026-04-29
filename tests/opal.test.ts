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
import { Opal } from "../target/types/opal";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

// seeds (must match Rust)
const S = {
  PROTOCOL_CONFIG: Buffer.from("protocol_config"),
  ASSERTION: Buffer.from("assertion"),
  BOND_VAULT: Buffer.from("bond_vault"),
  LLM_DISPUTE: Buffer.from("llm_dispute"),
  VOTE_DISPUTE: Buffer.from("vote_dispute"),
  LLM_ROUND: Buffer.from("llm_round"),
  VOTE_ROUND: Buffer.from("vote_round"),
};

// state constants (must match Rust)
const ST = {
  ASSERTED: 0,
  PENDING_LLM: 1,
  ASSERTED_LLM: 2,
  PENDING_VOTE: 3,
  VOTING: 4,
  RESOLVED: 5,
};

const OUT = {
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
    [S.ASSERTION, id.toBuffer()],
    programId,
  );
  const [bondVault] = PublicKey.findProgramAddressSync(
    [S.BOND_VAULT, id.toBuffer()],
    programId,
  );
  const [llmDispute] = PublicKey.findProgramAddressSync(
    [S.LLM_DISPUTE, assertion.toBuffer()],
    programId,
  );
  const [llmRound] = PublicKey.findProgramAddressSync(
    [S.LLM_ROUND, assertion.toBuffer()],
    programId,
  );
  const [voteDispute] = PublicKey.findProgramAddressSync(
    [S.VOTE_DISPUTE, assertion.toBuffer()],
    programId,
  );
  const [voteRound] = PublicKey.findProgramAddressSync(
    [S.VOTE_ROUND, assertion.toBuffer()],
    programId,
  );
  return { assertion, bondVault, llmDispute, llmRound, voteDispute, voteRound };
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
};

async function buildTokenEnv(connection: Connection): Promise<TokenEnv> {
  const mintAuthority = Keypair.generate();
  const treasury = Keypair.generate();
  const asserter = Keypair.generate();
  const llmDisputer = Keypair.generate();
  const voteDisputer = Keypair.generate();

  for (const kp of [
    mintAuthority,
    treasury,
    asserter,
    llmDisputer,
    voteDisputer,
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
    [S.PROTOCOL_CONFIG],
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
    })
    .accounts({
      authority: authority.publicKey,
      protocolConfig: configPda,
      pusdMint: token.mint,
      treasuryPusd: treasuryAta,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc({ commitment: "confirmed", skipPreflight: true });

  return { configPda, authority, treasuryAta };
}

describe("opal", () => {
  let provider: AnchorProvider;
  let connection: Connection;
  let program: Program<Opal>;
  let token: TokenEnv;
  let proto: ProtocolEnv;

  beforeAll(async () => {
    provider = AnchorProvider.env();
    anchor.setProvider(provider);
    connection = provider.connection;
    program = anchor.workspace.Opal as Program<Opal>;
    token = await buildTokenEnv(connection);
  });

  // ── Config validation MUST run before singleton init ──
  it("rejects invalid protocol config", async () => {
    const authority = Keypair.generate();
    await fund(connection, authority.publicKey, 10_000_000_000);

    const [configPda] = PublicKey.findProgramAddressSync(
      [S.PROTOCOL_CONFIG],
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
        })
        .accounts({
          authority: authority.publicKey,
          protocolConfig: configPda,
          pusdMint: token.mint,
          treasuryPusd: treasuryAta,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed", skipPreflight: true }),
    ).rejects.toThrow();
  });

  it("initializes protocol", async () => {
    proto = await setupProtocol(program, token, provider.wallet.payer);
  });

  // ── Happy paths ──
  it("undisputed path: creates, waits, finalizes with correct payouts", async () => {
    const id = Keypair.generate().publicKey;
    const { assertion, bondVault } = derivePDAs(id, program.programId);
    const bond = 200;
    const asserterStart = await balanceOf(connection, token.asserterAta);
    const treasuryStart = await balanceOf(connection, proto.treasuryAta);

    await program.methods
      .createAssertion({
        assertionId: id,
        statement: "Bitcoin > $100k by 2026",
        auxiliaryHash: "hash123",
        assertionBondAmountPusd: new BN(bond),
      })
      .accounts({
        asserter: token.asserter.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        bondVault,
        asserterPusd: token.asserterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.asserter])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    const acc = await program.account.assertionAccount.fetch(assertion);
    expect(acc.state).toBe(ST.ASSERTED);
    expect(acc.disputeCount).toBe(0);
    expect(acc.outcome).toBe(OUT.NONE);

    await sleep(4000);

    await program.methods
      .finalizeUndisputed()
      .accounts({
        finalizer: provider.wallet.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        bondVault,
        asserterPusd: token.asserterAta,
        treasuryPusd: proto.treasuryAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed", skipPreflight: true });

    const resolved = await program.account.assertionAccount.fetch(assertion);
    expect(resolved.state).toBe(ST.RESOLVED);
    expect(resolved.outcome).toBe(OUT.TRUE);
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
    const id = Keypair.generate().publicKey;
    const { assertion, bondVault, llmDispute, llmRound } = derivePDAs(
      id,
      program.programId,
    );
    const bond = 200;

    await program.methods
      .createAssertion({
        assertionId: id,
        statement: "ETH flips BTC",
        auxiliaryHash: "abc",
        assertionBondAmountPusd: new BN(bond),
      })
      .accounts({
        asserter: token.asserter.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        bondVault,
        asserterPusd: token.asserterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.asserter])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    const disputerStart = await balanceOf(connection, token.llmDisputerAta);

    await program.methods
      .disputeAssertion()
      .accounts({
        disputer: token.llmDisputer.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        llmDispute,
        llmResolutionRound: llmRound,
        bondVault,
        disputerPusd: token.llmDisputerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.llmDisputer])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    let acc = await program.account.assertionAccount.fetch(assertion);
    expect(acc.state).toBe(ST.PENDING_LLM);
    expect(acc.disputeCount).toBe(1);

    await program.methods
      .submitMockLlmResolution({ outcomeCode: 1 })
      .accounts({
        authority: proto.authority.publicKey,
        protocolConfig: proto.configPda,
        assertion,
        llmResolutionRound: llmRound,
      })
      .signers([proto.authority])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    acc = await program.account.assertionAccount.fetch(assertion);
    expect(acc.state).toBe(ST.ASSERTED_LLM);

    const round = await program.account.llmResolutionRound.fetch(llmRound);
    expect(round.outcome).toBe(OUT.FALSE);
    expect(round.challengeDeadline.toNumber()).toBeGreaterThan(0);

    await sleep(4000);

    await program.methods
      .finalizeLlmResolution()
      .accounts({
        finalizer: provider.wallet.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        llmDispute,
        llmResolutionRound: llmRound,
        bondVault,
        asserterPusd: token.asserterAta,
        llmDisputerPusd: token.llmDisputerAta,
        treasuryPusd: proto.treasuryAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed", skipPreflight: true });

    const resolved = await program.account.assertionAccount.fetch(assertion);
    expect(resolved.state).toBe(ST.RESOLVED);
    expect(resolved.outcome).toBe(OUT.FALSE);

    const dispute = await program.account.llmDisputeAccount.fetch(llmDispute);
    expect(dispute.settlementResolution).toBe(OUT.FALSE);

    // disputer was correct (outcome != TRUE). Net gain = assertion bond - fee = 195.
    expect(await balanceOf(connection, token.llmDisputerAta)).toBe(
      disputerStart + 195,
    );
  });

  it("full escalation path: escalates to vote and resolves", async () => {
    const id = Keypair.generate().publicKey;
    const {
      assertion,
      bondVault,
      llmDispute,
      llmRound,
      voteDispute,
      voteRound,
    } = derivePDAs(id, program.programId);

    await program.methods
      .createAssertion({
        assertionId: id,
        statement: "Solana TPS > 10000",
        auxiliaryHash: "perf",
        assertionBondAmountPusd: new BN(500),
      })
      .accounts({
        asserter: token.asserter.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        bondVault,
        asserterPusd: token.asserterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.asserter])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await program.methods
      .disputeAssertion()
      .accounts({
        disputer: token.llmDisputer.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        llmDispute,
        llmResolutionRound: llmRound,
        bondVault,
        disputerPusd: token.llmDisputerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.llmDisputer])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await program.methods
      .submitMockLlmResolution({ outcomeCode: 0 })
      .accounts({
        authority: proto.authority.publicKey,
        protocolConfig: proto.configPda,
        assertion,
        llmResolutionRound: llmRound,
      })
      .signers([proto.authority])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await program.methods
      .challengeLlmResolution()
      .accounts({
        disputer: token.voteDisputer.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        llmResolutionRound: llmRound,
        voteDispute,
        voteResolutionRound: voteRound,
        bondVault,
        disputerPusd: token.voteDisputerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.voteDisputer])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await program.methods
      .openVote()
      .accounts({
        authority: proto.authority.publicKey,
        protocolConfig: proto.configPda,
        assertion,
        voteResolutionRound: voteRound,
      })
      .signers([proto.authority])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    let acc = await program.account.assertionAccount.fetch(assertion);
    expect(acc.state).toBe(ST.VOTING);

    await sleep(5000);

    // sanity-check accounts exist before calling finalize
    await program.account.voteDisputeAccount.fetch(voteDispute);
    await program.account.voteResolutionRound.fetch(voteRound);

    // skipPreflight avoids an Anchor/web3.js preflight simulation bug on this instruction.
    await program.methods
      .finalizeVoteResolutionPlaceholder({ outcomeCode: 1 })
      .accounts({
        authority: proto.authority.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        llmDispute,
        voteDispute,
        voteResolutionRound: voteRound,
        bondVault,
        asserterPusd: token.asserterAta,
        llmDisputerPusd: token.llmDisputerAta,
        voteDisputerPusd: token.voteDisputerAta,
        treasuryPusd: proto.treasuryAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([proto.authority])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    const resolved = await program.account.assertionAccount.fetch(assertion);
    expect(resolved.state).toBe(ST.RESOLVED);
    expect(resolved.outcome).toBe(OUT.FALSE);
    expect(resolved.finalizedAt.toNumber()).toBeGreaterThan(0);

    const llmDisp = await program.account.llmDisputeAccount.fetch(llmDispute);
    expect(llmDisp.settlementResolution).not.toBe(OUT.NONE);

    const voteDisp =
      await program.account.voteDisputeAccount.fetch(voteDispute);
    expect(voteDisp.settlementResolution).not.toBe(OUT.NONE);

    const vr = await program.account.voteResolutionRound.fetch(voteRound);
    expect(vr.finalOutcome).toBe(OUT.FALSE);
  });

  // ── Negative cases ──
  it("error: premature finalizeUndisputed", async () => {
    const id = Keypair.generate().publicKey;
    const { assertion, bondVault } = derivePDAs(id, program.programId);

    await program.methods
      .createAssertion({
        assertionId: id,
        statement: "Test",
        auxiliaryHash: "h",
        assertionBondAmountPusd: new BN(200),
      })
      .accounts({
        asserter: token.asserter.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        bondVault,
        asserterPusd: token.asserterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.asserter])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await expect(
      program.methods
        .finalizeUndisputed()
        .accounts({
          finalizer: provider.wallet.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion,
          bondVault,
          asserterPusd: token.asserterAta,
          treasuryPusd: proto.treasuryAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed", skipPreflight: true }),
    ).rejects.toThrow();
  });

  it("error: insufficient bond", async () => {
    const id = Keypair.generate().publicKey;
    const { assertion, bondVault } = derivePDAs(id, program.programId);

    await expect(
      program.methods
        .createAssertion({
          assertionId: id,
          statement: "Fail",
          auxiliaryHash: "x",
          assertionBondAmountPusd: new BN(50),
        })
        .accounts({
          asserter: token.asserter.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion,
          bondVault,
          asserterPusd: token.asserterAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([token.asserter])
        .rpc({ commitment: "confirmed", skipPreflight: true }),
    ).rejects.toThrow();
  });

  it("error: disputing after liveness deadline", async () => {
    const id = Keypair.generate().publicKey;
    const { assertion, bondVault, llmDispute, llmRound } = derivePDAs(
      id,
      program.programId,
    );

    await program.methods
      .createAssertion({
        assertionId: id,
        statement: "Late dispute",
        auxiliaryHash: "late",
        assertionBondAmountPusd: new BN(200),
      })
      .accounts({
        asserter: token.asserter.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        bondVault,
        asserterPusd: token.asserterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.asserter])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await sleep(4000);

    await expect(
      program.methods
        .disputeAssertion()
        .accounts({
          disputer: token.llmDisputer.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion,
          llmDispute,
          llmResolutionRound: llmRound,
          bondVault,
          disputerPusd: token.llmDisputerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([token.llmDisputer])
        .rpc({ commitment: "confirmed", skipPreflight: true }),
    ).rejects.toThrow();
  });

  it("error: submitMockLlmResolution when state is Asserted", async () => {
    const id = Keypair.generate().publicKey;
    const { assertion, bondVault, llmRound } = derivePDAs(
      id,
      program.programId,
    );

    await program.methods
      .createAssertion({
        assertionId: id,
        statement: "No dispute",
        auxiliaryHash: "nodisp",
        assertionBondAmountPusd: new BN(200),
      })
      .accounts({
        asserter: token.asserter.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        bondVault,
        asserterPusd: token.asserterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.asserter])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await expect(
      program.methods
        .submitMockLlmResolution({ outcomeCode: 0 })
        .accounts({
          authority: proto.authority.publicKey,
          protocolConfig: proto.configPda,
          assertion,
          llmResolutionRound: llmRound,
        })
        .signers([proto.authority])
        .rpc({ commitment: "confirmed", skipPreflight: true }),
    ).rejects.toThrow();
  });

  it("error: challengeLlmResolution after challenge deadline", async () => {
    const id = Keypair.generate().publicKey;
    const {
      assertion,
      bondVault,
      llmDispute,
      llmRound,
      voteDispute,
      voteRound,
    } = derivePDAs(id, program.programId);

    await program.methods
      .createAssertion({
        assertionId: id,
        statement: "Missed challenge",
        auxiliaryHash: "miss",
        assertionBondAmountPusd: new BN(200),
      })
      .accounts({
        asserter: token.asserter.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        bondVault,
        asserterPusd: token.asserterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.asserter])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await program.methods
      .disputeAssertion()
      .accounts({
        disputer: token.llmDisputer.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        llmDispute,
        llmResolutionRound: llmRound,
        bondVault,
        disputerPusd: token.llmDisputerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.llmDisputer])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await program.methods
      .submitMockLlmResolution({ outcomeCode: 0 })
      .accounts({
        authority: proto.authority.publicKey,
        protocolConfig: proto.configPda,
        assertion,
        llmResolutionRound: llmRound,
      })
      .signers([proto.authority])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await sleep(4000);

    await expect(
      program.methods
        .challengeLlmResolution()
        .accounts({
          disputer: token.voteDisputer.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion,
          llmResolutionRound: llmRound,
          voteDispute,
          voteResolutionRound: voteRound,
          bondVault,
          disputerPusd: token.voteDisputerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([token.voteDisputer])
        .rpc({ commitment: "confirmed", skipPreflight: true }),
    ).rejects.toThrow();
  });

  it("error: disputing an already-disputed assertion", async () => {
    const id = Keypair.generate().publicKey;
    const { assertion, bondVault, llmDispute, llmRound } = derivePDAs(
      id,
      program.programId,
    );

    await program.methods
      .createAssertion({
        assertionId: id,
        statement: "Double dispute",
        auxiliaryHash: "dbl",
        assertionBondAmountPusd: new BN(200),
      })
      .accounts({
        asserter: token.asserter.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        bondVault,
        asserterPusd: token.asserterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.asserter])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await program.methods
      .disputeAssertion()
      .accounts({
        disputer: token.llmDisputer.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion,
        llmDispute,
        llmResolutionRound: llmRound,
        bondVault,
        disputerPusd: token.llmDisputerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.llmDisputer])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await expect(
      program.methods
        .disputeAssertion()
        .accounts({
          disputer: token.voteDisputer.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion,
          llmDispute,
          llmResolutionRound: llmRound,
          bondVault,
          disputerPusd: token.voteDisputerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([token.voteDisputer])
        .rpc({ commitment: "confirmed", skipPreflight: true }),
    ).rejects.toThrow();
  });

  it("error: mismatched llmDispute account", async () => {
    const id1 = Keypair.generate().publicKey;
    const id2 = Keypair.generate().publicKey;
    const pdas1 = derivePDAs(id1, program.programId);
    const pdas2 = derivePDAs(id2, program.programId);

    // create assertion1 and dispute it
    await program.methods
      .createAssertion({
        assertionId: id1,
        statement: "A1",
        auxiliaryHash: "a1",
        assertionBondAmountPusd: new BN(200),
      })
      .accounts({
        asserter: token.asserter.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion: pdas1.assertion,
        bondVault: pdas1.bondVault,
        asserterPusd: token.asserterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.asserter])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    await program.methods
      .disputeAssertion()
      .accounts({
        disputer: token.llmDisputer.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion: pdas1.assertion,
        llmDispute: pdas1.llmDispute,
        llmResolutionRound: pdas1.llmRound,
        bondVault: pdas1.bondVault,
        disputerPusd: token.llmDisputerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.llmDisputer])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    // create assertion2 (undisputed) so we can try to pass its dispute for assertion1
    await program.methods
      .createAssertion({
        assertionId: id2,
        statement: "A2",
        auxiliaryHash: "a2",
        assertionBondAmountPusd: new BN(200),
      })
      .accounts({
        asserter: token.asserter.publicKey,
        protocolConfig: proto.configPda,
        pusdMint: token.mint,
        assertion: pdas2.assertion,
        bondVault: pdas2.bondVault,
        asserterPusd: token.asserterAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([token.asserter])
      .rpc({ commitment: "confirmed", skipPreflight: true });

    // finalizeLlmResolution with assertion1 but llmDispute from assertion2
    // should fail because the dispute doesn't link back to assertion1
    await expect(
      program.methods
        .finalizeLlmResolution()
        .accounts({
          finalizer: provider.wallet.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion: pdas1.assertion,
          llmDispute: pdas2.llmDispute, // wrong dispute
          llmResolutionRound: pdas1.llmRound,
          bondVault: pdas1.bondVault,
          asserterPusd: token.asserterAta,
          llmDisputerPusd: token.llmDisputerAta,
          treasuryPusd: proto.treasuryAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed", skipPreflight: true }),
    ).rejects.toThrow();
  });
});
