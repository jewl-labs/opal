import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { describe, it, expect, beforeAll } from "bun:test";
import * as crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const IDL = require("../target/idl/opal.json");

const PROGRAM_ID = new PublicKey("72kZgK51BsRWaLVcMriBuskWbn4d5E4P9HVeV3oBFp2y");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function commitment(choiceByte: number, nonce: Buffer): number[] {
  return Array.from(
    crypto.createHash("sha256").update(Buffer.concat([Buffer.from([choiceByte]), nonce])).digest()
  );
}

function pda(seeds: (Buffer | Uint8Array)[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

const assertionPDA = (id: PublicKey) => pda([Buffer.from("assertion"), id.toBuffer()]);
const bondVaultPDA = (a: PublicKey) => pda([Buffer.from("bond_vault"), a.toBuffer()]);
const llmDisputePDA = (a: PublicKey) => pda([Buffer.from("llm_dispute"), a.toBuffer()]);
const llmRoundPDA = (a: PublicKey) => pda([Buffer.from("llm_round"), a.toBuffer()]);
const voteDisputePDA = (a: PublicKey) => pda([Buffer.from("vote_dispute"), a.toBuffer()]);
const voteRoundPDA = (a: PublicKey) => pda([Buffer.from("vote_round"), a.toBuffer()]);
const opalVaultPDA = (vr: PublicKey) => pda([Buffer.from("opal_vault"), vr.toBuffer()]);
const voteRecordPDA = (vr: PublicKey, voter: PublicKey) =>
  pda([Buffer.from("vote_record"), vr.toBuffer(), voter.toBuffer()]);
const configPDA = () => pda([Buffer.from("config")]);

// Time windows (keep short for fast tests, long enough to avoid flakiness)
const LIVENESS = 8;
const LLM_WINDOW = 8;
const VOTING_WINDOW = 6;
const REVEAL_WINDOW = 6;
const BOND_MIN = 1_000;

describe("opal oracle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new anchor.Program(IDL, PROGRAM_ID, provider) as anchor.Program<any>;
  const conn = provider.connection;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payer = (provider.wallet as any).payer as Keypair;

  const oracle = Keypair.generate();
  const asserter = Keypair.generate();
  const disputer = Keypair.generate();
  const voter1 = Keypair.generate();
  const voter2 = Keypair.generate();

  // fakeFeed: a non-existent account. Its owner defaults to SystemProgram.programId,
  // so setting switchboard_program = SystemProgram.programId passes the ownership check.
  const fakeFeed = Keypair.generate();

  let pusdMint: PublicKey;
  let opalMint: PublicKey;
  let asserterPusd: PublicKey;
  let disputerPusd: PublicKey;
  let voter1Opal: PublicKey;
  let voter2Opal: PublicKey;
  let voter1Pusd: PublicKey;
  let voter2Pusd: PublicKey;
  let treasuryPusd: PublicKey;
  let [cfgKey] = configPDA();

  const airdrop = async (key: PublicKey, sol = 10) => {
    const sig = await conn.requestAirdrop(key, sol * LAMPORTS_PER_SOL);
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
  };

  beforeAll(async () => {
    await Promise.all([
      airdrop(oracle.publicKey),
      airdrop(asserter.publicKey),
      airdrop(disputer.publicKey),
      airdrop(voter1.publicKey),
      airdrop(voter2.publicKey),
    ]);

    pusdMint = await createMint(conn, payer, payer.publicKey, null, 6);
    opalMint = await createMint(conn, payer, payer.publicKey, null, 6);

    asserterPusd = await createAccount(conn, payer, pusdMint, asserter.publicKey);
    disputerPusd = await createAccount(conn, payer, pusdMint, disputer.publicKey);
    voter1Opal = await createAccount(conn, payer, opalMint, voter1.publicKey);
    voter2Opal = await createAccount(conn, payer, opalMint, voter2.publicKey);
    voter1Pusd = await createAccount(conn, payer, pusdMint, voter1.publicKey);
    voter2Pusd = await createAccount(conn, payer, pusdMint, voter2.publicKey);
    // treasury is a token account owned by the payer (just needs to be a PUSD ATA)
    treasuryPusd = await createAccount(conn, payer, pusdMint, payer.publicKey);

    await mintTo(conn, payer, pusdMint, asserterPusd, payer, 50_000_000);
    await mintTo(conn, payer, pusdMint, disputerPusd, payer, 50_000_000);
    await mintTo(conn, payer, opalMint, voter1Opal, payer, 10_000_000);
    await mintTo(conn, payer, opalMint, voter2Opal, payer, 10_000_000);

    await program.methods
      .initializeConfig({
        oracleAuthority: oracle.publicKey,
        assertionBondMinPusd: new BN(BOND_MIN),
        llmDisputeBondRatio: 5000,   // 50%
        voteDisputeBondRatio: 5000,  // 50%
        protocolFeeBps: 100,         // 1%
        llmDisputerRewardShareBps: 2000,
        voteDisputerRewardShareBps: 1500,
        voterRewardShareBps: 500,
        treasuryShareBps: 500,
        incorrectVoteSlashBps: 1000, // 10%
        supermajorityBps: 6700,      // 67%
        livenessWindowSeconds: new BN(LIVENESS),
        llmChallengeWindowSeconds: new BN(LLM_WINDOW),
        voteSetupWindowSeconds: new BN(60),
        votingWindowSeconds: new BN(VOTING_WINDOW),
        revealWindowSeconds: new BN(REVEAL_WINDOW),
        // fakeFeed is uninitialized → owner = SystemProgram.programId
        switchboardProgram: SystemProgram.programId,
        switchboardQueue: Keypair.generate().publicKey,
        switchboardFeed: fakeFeed.publicKey,
        switchboardFeedHash: Array(32).fill(0),
        maxStalenessSlots: new BN(1_000_000),
      })
      .accounts({
        authority: payer.publicKey,
        config: cfgKey,
        pusdMint,
        opalMint,
        treasury: treasuryPusd,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  // ── shared helper ─────────────────────────────────────────────────────────

  async function makeAssertion(bondAmount = 10_000): Promise<{
    assertionKey: PublicKey;
    bondVaultKey: PublicKey;
  }> {
    const id = Keypair.generate().publicKey;
    const [assertionKey] = assertionPDA(id);
    const [bondVaultKey] = bondVaultPDA(assertionKey);

    await program.methods
      .createAssertion({
        id,
        statement: "ETH flips BTC by market cap before 2026.",
        auxiliaryHash: "a".repeat(64),
        bondAmount: new BN(bondAmount),
      })
      .accounts({
        asserter: asserter.publicKey,
        assertion: assertionKey,
        bondVault: bondVaultKey,
        asserterTokenAccount: asserterPusd,
        config: cfgKey,
        pusdMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([asserter])
      .rpc();

    return { assertionKey, bondVaultKey };
  }

  async function dispute(assertionKey: PublicKey, bondVaultKey: PublicKey) {
    const [llmDisputeKey] = llmDisputePDA(assertionKey);
    const [llmRoundKey] = llmRoundPDA(assertionKey);
    await program.methods
      .disputeAssertion({ promptHash: Array(32).fill(1), variableOverridesHash: null })
      .accounts({
        disputer: disputer.publicKey,
        assertion: assertionKey,
        llmDispute: llmDisputeKey,
        llmRound: llmRoundKey,
        bondVault: bondVaultKey,
        disputerTokenAccount: disputerPusd,
        config: cfgKey,
        pusdMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([disputer])
      .rpc();
    return { llmDisputeKey, llmRoundKey };
  }

  async function submitLLM(assertionKey: PublicKey, llmRoundKey: PublicKey, outcomeCode: number) {
    await program.methods
      .submitLlmResolution({
        outcomeCode,
        quoteSlot: new BN(0),
        responseHash: null,
        evidenceHash: null,
      })
      .accounts({
        oracleAuthority: oracle.publicKey,
        assertion: assertionKey,
        llmRound: llmRoundKey,
        switchboardFeed: fakeFeed.publicKey,
        config: cfgKey,
      })
      .signers([oracle])
      .rpc();
  }

  async function challenge(
    assertionKey: PublicKey,
    bondVaultKey: PublicKey,
    llmRoundKey: PublicKey
  ) {
    const [voteDisputeKey] = voteDisputePDA(assertionKey);
    const [voteRoundKey] = voteRoundPDA(assertionKey);
    await program.methods
      .challengeLlmResolution()
      .accounts({
        disputer: disputer.publicKey,
        assertion: assertionKey,
        llmRound: llmRoundKey,
        voteDispute: voteDisputeKey,
        voteRound: voteRoundKey,
        bondVault: bondVaultKey,
        disputerTokenAccount: disputerPusd,
        config: cfgKey,
        pusdMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([disputer])
      .rpc();
    return { voteDisputeKey, voteRoundKey };
  }

  // ── initialize_config ─────────────────────────────────────────────────────

  describe("initialize_config", () => {
    it("rejects update from non-authority", async () => {
      const fake = Keypair.generate();
      await airdrop(fake.publicKey, 2);
      let threw = false;
      try {
        await program.methods
          .updateConfig({
            oracleAuthority: oracle.publicKey,
            assertionBondMinPusd: new BN(BOND_MIN),
            llmDisputeBondRatio: 5000,
            voteDisputeBondRatio: 5000,
            protocolFeeBps: 100,
            llmDisputerRewardShareBps: 2000,
            voteDisputerRewardShareBps: 1500,
            voterRewardShareBps: 500,
            treasuryShareBps: 500,
            incorrectVoteSlashBps: 1000,
            supermajorityBps: 6700,
            livenessWindowSeconds: new BN(LIVENESS),
            llmChallengeWindowSeconds: new BN(LLM_WINDOW),
            voteSetupWindowSeconds: new BN(60),
            votingWindowSeconds: new BN(VOTING_WINDOW),
            revealWindowSeconds: new BN(REVEAL_WINDOW),
            switchboardProgram: SystemProgram.programId,
            switchboardQueue: Keypair.generate().publicKey,
            switchboardFeed: fakeFeed.publicKey,
            switchboardFeedHash: Array(32).fill(0),
            maxStalenessSlots: new BN(1_000_000),
          })
          .accounts({
            authority: fake.publicKey,
            config: cfgKey,
            pusdMint,
            opalMint,
            treasury: treasuryPusd,
            systemProgram: SystemProgram.programId,
          })
          .signers([fake])
          .rpc();
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    it("rejects invalid BPS sum", async () => {
      let threw = false;
      try {
        await program.methods
          .updateConfig({
            oracleAuthority: oracle.publicKey,
            assertionBondMinPusd: new BN(BOND_MIN),
            llmDisputeBondRatio: 5000,
            voteDisputeBondRatio: 5000,
            protocolFeeBps: 10001, // > 10000
            llmDisputerRewardShareBps: 0,
            voteDisputerRewardShareBps: 0,
            voterRewardShareBps: 0,
            treasuryShareBps: 0,
            incorrectVoteSlashBps: 0,
            supermajorityBps: 6700,
            livenessWindowSeconds: new BN(LIVENESS),
            llmChallengeWindowSeconds: new BN(LLM_WINDOW),
            voteSetupWindowSeconds: new BN(60),
            votingWindowSeconds: new BN(VOTING_WINDOW),
            revealWindowSeconds: new BN(REVEAL_WINDOW),
            switchboardProgram: SystemProgram.programId,
            switchboardQueue: Keypair.generate().publicKey,
            switchboardFeed: fakeFeed.publicKey,
            switchboardFeedHash: Array(32).fill(0),
            maxStalenessSlots: new BN(1_000_000),
          })
          .accounts({
            authority: payer.publicKey,
            config: cfgKey,
            pusdMint,
            opalMint,
            treasury: treasuryPusd,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  // ── create_assertion ──────────────────────────────────────────────────────

  describe("create_assertion", () => {
    it("creates with correct state", async () => {
      const { assertionKey } = await makeAssertion();
      const acc = await program.account.assertionAccount.fetch(assertionKey);
      expect(acc.state).toMatchObject({ asserted: {} });
      expect(acc.disputeCount).toBe(0);
      expect(acc.outcome).toBeNull();
    });

    it("rejects bond below minimum", async () => {
      const id = Keypair.generate().publicKey;
      const [ak] = assertionPDA(id);
      const [bv] = bondVaultPDA(ak);
      let threw = false;
      try {
        await program.methods
          .createAssertion({ id, statement: "test", auxiliaryHash: "a".repeat(64), bondAmount: new BN(1) })
          .accounts({ asserter: asserter.publicKey, assertion: ak, bondVault: bv, asserterTokenAccount: asserterPusd, config: cfgKey, pusdMint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
          .signers([asserter])
          .rpc();
      } catch { threw = true; }
      expect(threw).toBe(true);
    });

    it("rejects empty statement", async () => {
      const id = Keypair.generate().publicKey;
      const [ak] = assertionPDA(id);
      const [bv] = bondVaultPDA(ak);
      let threw = false;
      try {
        await program.methods
          .createAssertion({ id, statement: "", auxiliaryHash: "a".repeat(64), bondAmount: new BN(10_000) })
          .accounts({ asserter: asserter.publicKey, assertion: ak, bondVault: bv, asserterTokenAccount: asserterPusd, config: cfgKey, pusdMint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
          .signers([asserter])
          .rpc();
      } catch { threw = true; }
      expect(threw).toBe(true);
    });

    it("rejects auxiliary hash with wrong length", async () => {
      const id = Keypair.generate().publicKey;
      const [ak] = assertionPDA(id);
      const [bv] = bondVaultPDA(ak);
      let threw = false;
      try {
        await program.methods
          .createAssertion({ id, statement: "claim", auxiliaryHash: "tooshort", bondAmount: new BN(10_000) })
          .accounts({ asserter: asserter.publicKey, assertion: ak, bondVault: bv, asserterTokenAccount: asserterPusd, config: cfgKey, pusdMint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
          .signers([asserter])
          .rpc();
      } catch { threw = true; }
      expect(threw).toBe(true);
    });
  });

  // ── finalize_undisputed ───────────────────────────────────────────────────

  describe("finalize_undisputed", () => {
    it("fails before liveness expires", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      let threw = false;
      try {
        await program.methods.finalizeUndisputed()
          .accounts({ caller: payer.publicKey, assertion: assertionKey, bondVault: bondVaultKey, asserterTokenAccount: asserterPusd, treasuryTokenAccount: treasuryPusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
          .rpc();
      } catch { threw = true; }
      expect(threw).toBe(true);
    });

    it("resolves True and returns bond after liveness expires", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      await sleep((LIVENESS + 1) * 1000);

      const before = (await getAccount(conn, asserterPusd)).amount;
      await program.methods.finalizeUndisputed()
        .accounts({ caller: payer.publicKey, assertion: assertionKey, bondVault: bondVaultKey, asserterTokenAccount: asserterPusd, treasuryTokenAccount: treasuryPusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();

      const acc = await program.account.assertionAccount.fetch(assertionKey);
      expect(acc.state).toMatchObject({ resolved: {} });
      expect(acc.outcome).toMatchObject({ true: {} });
      expect((await getAccount(conn, asserterPusd)).amount > before).toBe(true);
    });
  });

  // ── dispute_assertion ─────────────────────────────────────────────────────

  describe("dispute_assertion", () => {
    it("transitions to PendingLLM and locks bond", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      await dispute(assertionKey, bondVaultKey);
      const acc = await program.account.assertionAccount.fetch(assertionKey);
      expect(acc.state).toMatchObject({ pendingLlm: {} });
      expect(acc.disputeCount).toBe(1);
    });

    it("rejects dispute after liveness expires", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      await sleep((LIVENESS + 1) * 1000);
      let threw = false;
      try { await dispute(assertionKey, bondVaultKey); } catch { threw = true; }
      expect(threw).toBe(true);
    });

    it("rejects double dispute", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      await dispute(assertionKey, bondVaultKey);
      let threw = false;
      try { await dispute(assertionKey, bondVaultKey); } catch { threw = true; }
      expect(threw).toBe(true);
    });
  });

  // ── submit_llm_resolution ─────────────────────────────────────────────────

  describe("submit_llm_resolution", () => {
    it("rejects invalid outcome code", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      let threw = false;
      try { await submitLLM(assertionKey, llmRoundKey, 99); } catch { threw = true; }
      expect(threw).toBe(true);
    });

    it("rejects unauthorized oracle", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      const fakeOracle = Keypair.generate();
      await airdrop(fakeOracle.publicKey);
      let threw = false;
      try {
        await program.methods
          .submitLlmResolution({ outcomeCode: 0, quoteSlot: new BN(0), responseHash: null, evidenceHash: null })
          .accounts({ oracleAuthority: fakeOracle.publicKey, assertion: assertionKey, llmRound: llmRoundKey, switchboardFeed: fakeFeed.publicKey, config: cfgKey })
          .signers([fakeOracle])
          .rpc();
      } catch { threw = true; }
      expect(threw).toBe(true);
    });

    it("rejects duplicate submission", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      await submitLLM(assertionKey, llmRoundKey, 0);
      let threw = false;
      try { await submitLLM(assertionKey, llmRoundKey, 1); } catch { threw = true; }
      expect(threw).toBe(true);
    });
  });

  // ── finalize_llm_resolution ───────────────────────────────────────────────

  describe("finalize_llm_resolution", () => {
    it("disputer wins when outcome is False", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmDisputeKey, llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      await submitLLM(assertionKey, llmRoundKey, 1); // False

      await sleep((LLM_WINDOW + 1) * 1000);

      const before = (await getAccount(conn, disputerPusd)).amount;
      await program.methods.finalizeLlmResolution()
        .accounts({ caller: payer.publicKey, assertion: assertionKey, llmRound: llmRoundKey, llmDispute: llmDisputeKey, bondVault: bondVaultKey, asserterTokenAccount: asserterPusd, disputerTokenAccount: disputerPusd, treasuryTokenAccount: treasuryPusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();

      const acc = await program.account.assertionAccount.fetch(assertionKey);
      expect(acc.outcome).toMatchObject({ false: {} });
      expect((await getAccount(conn, disputerPusd)).amount > before).toBe(true);
    });

    it("asserter wins when outcome is True", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmDisputeKey, llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      await submitLLM(assertionKey, llmRoundKey, 0); // True

      await sleep((LLM_WINDOW + 1) * 1000);

      const before = (await getAccount(conn, asserterPusd)).amount;
      await program.methods.finalizeLlmResolution()
        .accounts({ caller: payer.publicKey, assertion: assertionKey, llmRound: llmRoundKey, llmDispute: llmDisputeKey, bondVault: bondVaultKey, asserterTokenAccount: asserterPusd, disputerTokenAccount: disputerPusd, treasuryTokenAccount: treasuryPusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();

      const acc = await program.account.assertionAccount.fetch(assertionKey);
      expect(acc.outcome).toMatchObject({ true: {} });
      expect((await getAccount(conn, asserterPusd)).amount > before).toBe(true);
    });

    it("rejects finalize before challenge window expires", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmDisputeKey, llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      await submitLLM(assertionKey, llmRoundKey, 0);
      let threw = false;
      try {
        await program.methods.finalizeLlmResolution()
          .accounts({ caller: payer.publicKey, assertion: assertionKey, llmRound: llmRoundKey, llmDispute: llmDisputeKey, bondVault: bondVaultKey, asserterTokenAccount: asserterPusd, disputerTokenAccount: disputerPusd, treasuryTokenAccount: treasuryPusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
          .rpc();
      } catch { threw = true; }
      expect(threw).toBe(true);
    });
  });

  // ── challenge_llm_resolution ──────────────────────────────────────────────

  describe("challenge_llm_resolution", () => {
    it("transitions to PendingVote", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      await submitLLM(assertionKey, llmRoundKey, 1);
      await challenge(assertionKey, bondVaultKey, llmRoundKey);

      const acc = await program.account.assertionAccount.fetch(assertionKey);
      expect(acc.state).toMatchObject({ pendingVote: {} });
      expect(acc.disputeCount).toBe(2);
    });

    it("rejects challenge after challenge window expires", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      await submitLLM(assertionKey, llmRoundKey, 1);
      await sleep((LLM_WINDOW + 1) * 1000);
      let threw = false;
      try { await challenge(assertionKey, bondVaultKey, llmRoundKey); } catch { threw = true; }
      expect(threw).toBe(true);
    });
  });

  // ── full vote path ────────────────────────────────────────────────────────

  describe("vote path", () => {
    it("resolves via supermajority: both voters vote True → outcome True", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmDisputeKey, llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      await submitLLM(assertionKey, llmRoundKey, 1); // LLM says False
      const { voteDisputeKey, voteRoundKey } = await challenge(assertionKey, bondVaultKey, llmRoundKey);
      const [opalVaultKey] = opalVaultPDA(voteRoundKey);

      // Open vote
      await program.methods.openVote()
        .accounts({ caller: payer.publicKey, assertion: assertionKey, voteRound: voteRoundKey, opalVault: opalVaultKey, opalMint, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .rpc();

      expect((await program.account.assertionAccount.fetch(assertionKey)).state).toMatchObject({ voting: {} });

      // Cast votes (choice byte 0 = True)
      const nonce1 = crypto.randomBytes(32);
      const nonce2 = crypto.randomBytes(32);
      const [vr1] = voteRecordPDA(voteRoundKey, voter1.publicKey);
      const [vr2] = voteRecordPDA(voteRoundKey, voter2.publicKey);

      await program.methods.castVote({ commitment: commitment(0, nonce1), lockedOpal: new BN(1_000_000) })
        .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1, opalVault: opalVaultKey, voterOpalAccount: voter1Opal, config: cfgKey, opalMint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .signers([voter1]).rpc();

      await program.methods.castVote({ commitment: commitment(0, nonce2), lockedOpal: new BN(1_000_000) })
        .accounts({ voter: voter2.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr2, opalVault: opalVaultKey, voterOpalAccount: voter2Opal, config: cfgKey, opalMint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .signers([voter2]).rpc();

      // Wait for voting to close, then reveal
      await sleep((VOTING_WINDOW + 1) * 1000);

      await program.methods.revealVote({ choice: { true: {} }, nonce: Array.from(nonce1) })
        .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1 })
        .signers([voter1]).rpc();

      await program.methods.revealVote({ choice: { true: {} }, nonce: Array.from(nonce2) })
        .accounts({ voter: voter2.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr2 })
        .signers([voter2]).rpc();

      // Wait for reveal to close, then finalize
      await sleep((REVEAL_WINDOW + 1) * 1000);

      await program.methods.finalizeVoteResolution()
        .accounts({ caller: payer.publicKey, assertion: assertionKey, voteRound: voteRoundKey, llmDispute: llmDisputeKey, voteDispute: voteDisputeKey, bondVault: bondVaultKey, llmDisputerTokenAccount: disputerPusd, voteDisputerTokenAccount: disputerPusd, asserterTokenAccount: asserterPusd, treasuryTokenAccount: treasuryPusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();

      const acc = await program.account.assertionAccount.fetch(assertionKey);
      expect(acc.state).toMatchObject({ resolved: {} });
      expect(acc.outcome).toMatchObject({ true: {} });

      // Settle voter1 (correct → full OPAL return + PUSD reward)
      const opalBefore = (await getAccount(conn, voter1Opal)).amount;
      await program.methods.settleVoter()
        .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1, opalVault: opalVaultKey, voterOpalAccount: voter1Opal, bondVault: bondVaultKey, voterPusdAccount: voter1Pusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
        .signers([voter1]).rpc();

      expect((await getAccount(conn, voter1Opal)).amount > opalBefore).toBe(true);
    });

    it("slashes OPAL for incorrect voter", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmDisputeKey, llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      await submitLLM(assertionKey, llmRoundKey, 1); // LLM says False
      const { voteDisputeKey, voteRoundKey } = await challenge(assertionKey, bondVaultKey, llmRoundKey);
      const [opalVaultKey] = opalVaultPDA(voteRoundKey);

      await program.methods.openVote()
        .accounts({ caller: payer.publicKey, assertion: assertionKey, voteRound: voteRoundKey, opalVault: opalVaultKey, opalMint, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .rpc();

      // voter1 votes True (correct), voter2 votes False (incorrect — supermajority will be True)
      const nonce1 = crypto.randomBytes(32);
      const nonce2 = crypto.randomBytes(32);
      const [vr1] = voteRecordPDA(voteRoundKey, voter1.publicKey);
      const [vr2] = voteRecordPDA(voteRoundKey, voter2.publicKey);

      await program.methods.castVote({ commitment: commitment(0, nonce1), lockedOpal: new BN(5_000_000) })
        .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1, opalVault: opalVaultKey, voterOpalAccount: voter1Opal, config: cfgKey, opalMint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .signers([voter1]).rpc();

      await program.methods.castVote({ commitment: commitment(1, nonce2), lockedOpal: new BN(1_000_000) })
        .accounts({ voter: voter2.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr2, opalVault: opalVaultKey, voterOpalAccount: voter2Opal, config: cfgKey, opalMint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .signers([voter2]).rpc();

      await sleep((VOTING_WINDOW + 1) * 1000);

      await program.methods.revealVote({ choice: { true: {} }, nonce: Array.from(nonce1) })
        .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1 })
        .signers([voter1]).rpc();

      await program.methods.revealVote({ choice: { false: {} }, nonce: Array.from(nonce2) })
        .accounts({ voter: voter2.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr2 })
        .signers([voter2]).rpc();

      await sleep((REVEAL_WINDOW + 1) * 1000);

      await program.methods.finalizeVoteResolution()
        .accounts({ caller: payer.publicKey, assertion: assertionKey, voteRound: voteRoundKey, llmDispute: llmDisputeKey, voteDispute: voteDisputeKey, bondVault: bondVaultKey, llmDisputerTokenAccount: disputerPusd, voteDisputerTokenAccount: disputerPusd, asserterTokenAccount: asserterPusd, treasuryTokenAccount: treasuryPusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();

      // Settle voter2 (incorrect → OPAL slashed by 10%)
      const opalBefore = (await getAccount(conn, voter2Opal)).amount;
      await program.methods.settleVoter()
        .accounts({ voter: voter2.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr2, opalVault: opalVaultKey, voterOpalAccount: voter2Opal, bondVault: bondVaultKey, voterPusdAccount: voter2Pusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
        .signers([voter2]).rpc();

      const returned = (await getAccount(conn, voter2Opal)).amount - opalBefore;
      // locked 1_000_000, slashed 10% = 100_000, so return = 900_000
      expect(returned).toBe(BigInt(900_000));
    });

    it("rejects reveal with wrong nonce", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      await submitLLM(assertionKey, llmRoundKey, 1);
      const { voteRoundKey } = await challenge(assertionKey, bondVaultKey, llmRoundKey);
      const [opalVaultKey] = opalVaultPDA(voteRoundKey);

      await program.methods.openVote()
        .accounts({ caller: payer.publicKey, assertion: assertionKey, voteRound: voteRoundKey, opalVault: opalVaultKey, opalMint, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .rpc();

      const nonce = crypto.randomBytes(32);
      const [vr1] = voteRecordPDA(voteRoundKey, voter1.publicKey);

      await program.methods.castVote({ commitment: commitment(0, nonce), lockedOpal: new BN(1_000_000) })
        .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1, opalVault: opalVaultKey, voterOpalAccount: voter1Opal, config: cfgKey, opalMint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .signers([voter1]).rpc();

      await sleep((VOTING_WINDOW + 1) * 1000);

      let threw = false;
      try {
        await program.methods.revealVote({ choice: { true: {} }, nonce: Array.from(crypto.randomBytes(32)) })
          .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1 })
          .signers([voter1]).rpc();
      } catch { threw = true; }
      expect(threw).toBe(true);
    });

    it("rejects cast_vote with zero OPAL", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      await submitLLM(assertionKey, llmRoundKey, 1);
      const { voteRoundKey } = await challenge(assertionKey, bondVaultKey, llmRoundKey);
      const [opalVaultKey] = opalVaultPDA(voteRoundKey);
      const [vr1] = voteRecordPDA(voteRoundKey, voter1.publicKey);

      await program.methods.openVote()
        .accounts({ caller: payer.publicKey, assertion: assertionKey, voteRound: voteRoundKey, opalVault: opalVaultKey, opalMint, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .rpc();

      let threw = false;
      try {
        await program.methods.castVote({ commitment: Array(32).fill(0), lockedOpal: new BN(0) })
          .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1, opalVault: opalVaultKey, voterOpalAccount: voter1Opal, config: cfgKey, opalMint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
          .signers([voter1]).rpc();
      } catch { threw = true; }
      expect(threw).toBe(true);
    });

    it("rejects double settle", async () => {
      const { assertionKey, bondVaultKey } = await makeAssertion();
      const { llmDisputeKey, llmRoundKey } = await dispute(assertionKey, bondVaultKey);
      await submitLLM(assertionKey, llmRoundKey, 1);
      const { voteDisputeKey, voteRoundKey } = await challenge(assertionKey, bondVaultKey, llmRoundKey);
      const [opalVaultKey] = opalVaultPDA(voteRoundKey);
      const [vr1] = voteRecordPDA(voteRoundKey, voter1.publicKey);

      await program.methods.openVote()
        .accounts({ caller: payer.publicKey, assertion: assertionKey, voteRound: voteRoundKey, opalVault: opalVaultKey, opalMint, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .rpc();

      const nonce = crypto.randomBytes(32);
      await program.methods.castVote({ commitment: commitment(0, nonce), lockedOpal: new BN(1_000_000) })
        .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1, opalVault: opalVaultKey, voterOpalAccount: voter1Opal, config: cfgKey, opalMint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .signers([voter1]).rpc();

      await sleep((VOTING_WINDOW + 1) * 1000);

      await program.methods.revealVote({ choice: { true: {} }, nonce: Array.from(nonce) })
        .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1 })
        .signers([voter1]).rpc();

      await sleep((REVEAL_WINDOW + 1) * 1000);

      await program.methods.finalizeVoteResolution()
        .accounts({ caller: payer.publicKey, assertion: assertionKey, voteRound: voteRoundKey, llmDispute: llmDisputeKey, voteDispute: voteDisputeKey, bondVault: bondVaultKey, llmDisputerTokenAccount: disputerPusd, voteDisputerTokenAccount: disputerPusd, asserterTokenAccount: asserterPusd, treasuryTokenAccount: treasuryPusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();

      await program.methods.settleVoter()
        .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1, opalVault: opalVaultKey, voterOpalAccount: voter1Opal, bondVault: bondVaultKey, voterPusdAccount: voter1Pusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
        .signers([voter1]).rpc();

      // Second settle must fail
      let threw = false;
      try {
        await program.methods.settleVoter()
          .accounts({ voter: voter1.publicKey, assertion: assertionKey, voteRound: voteRoundKey, voteRecord: vr1, opalVault: opalVaultKey, voterOpalAccount: voter1Opal, bondVault: bondVaultKey, voterPusdAccount: voter1Pusd, config: cfgKey, tokenProgram: TOKEN_PROGRAM_ID })
          .signers([voter1]).rpc();
      } catch { threw = true; }
      expect(threw).toBe(true);
    });
  });
});
