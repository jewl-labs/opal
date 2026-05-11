import { describe, it, expect, beforeAll } from "bun:test";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { CrossbarClient } from "@switchboard-xyz/common";
import { OracleQuote, Queue } from "@switchboard-xyz/on-demand";
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

const SWITCHBOARD_DEVNET_PROGRAM =
  "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2";
const DEFAULT_SWITCHBOARD_QUEUE =
  "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7";

const CROSSBAR_URL = "https://crossbar.switchboard.xyz";
const SYSVAR_INSTRUCTIONS_PUBKEY = new PublicKey(
  "Sysvar1nstructions1111111111111111111111111",
);
const cb = new CrossbarClient(CROSSBAR_URL);

const SWITCHBOARD_QUEUE_PUBKEY = new PublicKey(DEFAULT_SWITCHBOARD_QUEUE);

const DEVNET_PROGRAM_ID = "8NCcxyAzKiAHxJ9DMnADtxShYutS9w81wHcXqgCavTBy";

const BS58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(encoded: string): Uint8Array {
  if (encoded.length === 0) return new Uint8Array(0);

  const bytes = [0];
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i]!;
    const c = BS58_ALPHABET.indexOf(char);
    if (c < 0) throw new Error(`Invalid base58 character: ${char}`);

    let carry = c;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (let i = 0; i < encoded.length && encoded[i]! === "1"; i++) {
    bytes.push(0);
  }

  return new Uint8Array(bytes.reverse());
}

function loadKeypairFromEnv(varName: string): Keypair {
  const raw = Bun.env[varName] || process.env[varName];
  if (!raw || raw.trim() === "") {
    throw new Error(
      `Missing required env var: ${varName}. Set it in .env.devnet`,
    );
  }

  const secretKey = base58Decode(raw.trim());
  if (secretKey.length === 0) {
    throw new Error(`Invalid secret key for ${varName}: empty after decode`);
  }

  return Keypair.fromSecretKey(secretKey);
}

const AUTHORITY = loadKeypairFromEnv("DEVNET_AUTHORITY_KEY");
const ASSERTER = loadKeypairFromEnv("DEVNET_ASSERTER_KEY");
const LLM_DISPUTER = loadKeypairFromEnv("DEVNET_LLM_DISPUTER_KEY");
const VOTE_DISPUTER = loadKeypairFromEnv("DEVNET_VOTE_DISPUTER_KEY");
const MINT_KEYPAIR = loadKeypairFromEnv("DEVNET_MINT_KEY");

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
  return { assertion, bondVault, llmDispute, llmRound, voteDispute, voteRound };
}

type TokenEnv = {
  mint: PublicKey;
  mintAuthority: Keypair;
  treasury: PublicKey;
  asserter: Keypair;
  asserterAta: PublicKey;
  llmDisputer: Keypair;
  llmDisputerAta: PublicKey;
  voteDisputer: Keypair;
  voteDisputerAta: PublicKey;
};

type ProtocolEnv = {
  configPda: PublicKey;
  authority: Keypair;
  treasuryAta: PublicKey;
};

async function buildTokenEnv(connection: Connection): Promise<TokenEnv> {
  let mint: PublicKey;
  try {
    mint = await createMint(
      connection,
      MINT_KEYPAIR,
      MINT_KEYPAIR.publicKey,
      null,
      6,
      undefined,
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
    );
  } catch (_e) {
    mint = MINT_KEYPAIR.publicKey;
  }

  const treasury = AUTHORITY.publicKey;

  const participants = [
    { owner: AUTHORITY },
    { owner: ASSERTER },
    { owner: LLM_DISPUTER },
    { owner: VOTE_DISPUTER },
  ];

  const atas: PublicKey[] = [];
  for (const { owner } of participants) {
    const ata = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        MINT_KEYPAIR,
        mint,
        owner.publicKey,
        true,
        undefined,
        { commitment: "confirmed" },
        TOKEN_PROGRAM_ID,
      )
    ).address;
    atas.push(ata);
  }

  const MIN_BALANCE = 1_000_000_000;
  for (const ata of atas) {
    const bal = await balanceOf(connection, ata);
    if (bal < MIN_BALANCE) {
      await mintTo(
        connection,
        MINT_KEYPAIR,
        mint,
        ata,
        MINT_KEYPAIR,
        1_000_000_000_000,
        [],
        { commitment: "confirmed" },
        TOKEN_PROGRAM_ID,
      );
    }
  }

  return {
    mint,
    mintAuthority: MINT_KEYPAIR,
    treasury,
    asserter: ASSERTER,
    asserterAta: atas[1]!,
    llmDisputer: LLM_DISPUTER,
    llmDisputerAta: atas[2]!,
    voteDisputer: VOTE_DISPUTER,
    voteDisputerAta: atas[3]!,
  };
}

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
      token.treasury,
      true,
      undefined,
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
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
      livenessWindowSeconds: new BN(3),
      llmChallengeWindowSeconds: new BN(30),
      voteSetupWindowSeconds: new BN(60),
      votingWindowSeconds: new BN(300),
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
        assertion: a.pdas.assertion,
        voteResolutionRound: a.pdas.voteRound,
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
}

async function setupSwitchboardFeed(
  _payer: Keypair,
  _connection: Connection,
): Promise<{ feedHash: Uint8Array; queuePubkey: PublicKey }> {
  const envFeedHash =
    Bun.env.SWITCHBOARD_FEED_HASH || process.env.SWITCHBOARD_FEED_HASH;
  if (envFeedHash) {
    const hex = envFeedHash.replace(/^0x/, "");
    if (hex.length !== 64)
      throw new Error(`Invalid SWITCHBOARD_FEED_HASH: expected 64 hex chars`);
    const bytes = Buffer.from(hex, "hex");
    return {
      feedHash: new Uint8Array(bytes),
      queuePubkey: SWITCHBOARD_QUEUE_PUBKEY,
    };
  }

  throw new Error(
    "SWITCHBOARD_FEED_HASH env var not set. " +
      "Set it to a known devnet feed hash (64 hex chars) that returns integer values 0-3. " +
      "Example: create a feed at https://ondemand.switchboard.xyz/devnet",
  );
}

async function buildSwitchboardResolutionTx(
  ctx: TestContext,
  assertion: Assertion,
  feedHash: Uint8Array,
  queuePubkey: PublicKey,
  _maxStalenessSlots: number,
  promptHash: number[],
): Promise<Transaction> {
  const feedHashHexStr = `0x${Buffer.from(feedHash).toString("hex")}`;

  const sbProgram = { provider: { connection: ctx.connection } } as any;
  const queue = new Queue(sbProgram, queuePubkey);

  const sigVerifyIx = await queue.fetchQuoteIx(cb, [feedHashHexStr], {
    numSignatures: 1,
    instructionIdx: 0,
  });

  const submitIx = await ctx.program.methods
    .submitLlmResolution({
      promptHash: promptHash as number[] & { length: 32 },
    })
    .accounts({
      submitter: ctx.provider.wallet.publicKey,
      protocolConfig: ctx.proto.configPda,
      assertion: assertion.pdas.assertion,
      llmResolutionRound: assertion.pdas.llmRound,
      switchboardQueue: queuePubkey,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

  const tx = new Transaction();
  tx.add(sigVerifyIx);
  tx.add(submitIx);
  tx.feePayer = ctx.provider.wallet.publicKey;

  return tx;
}

async function configureLlmRoundForSwitchboard(
  ctx: TestContext,
  assertion: Assertion,
  feedHash: Uint8Array,
  queuePubkey: PublicKey,
  maxStalenessSlots: number = 300,
): Promise<string> {
  return ctx.configureLlmRound(
    assertion,
    queuePubkey,
    feedHash,
    maxStalenessSlots,
  );
}

function getSwitchboardQuotePubkey(feedHash: Uint8Array): PublicKey {
  const feedHashHexStr = `0x${Buffer.from(feedHash).toString("hex")}`;
  const [quotePubkey] = OracleQuote.getCanonicalPubkey(
    SWITCHBOARD_QUEUE_PUBKEY,
    [feedHashHexStr],
  );
  return quotePubkey;
}

describe("opal-devnet", () => {
  let provider: AnchorProvider;
  let connection: Connection;
  let program: Program<Opal>;
  let token: TokenEnv;
  let proto: ProtocolEnv;
  let ctx: TestContext;

  beforeAll(async () => {
    const rpcUrl =
      Bun.env.SOLANA_RPC_URL ||
      process.env.SOLANA_RPC_URL ||
      "https://api.devnet.solana.com";
    connection = new Connection(rpcUrl, "confirmed");

    if (!connection.rpcEndpoint.includes("devnet")) {
      throw new Error(
        `SAFETY: RPC endpoint "${connection.rpcEndpoint}" is NOT devnet. ` +
          `Devnet tests destroy real tokens on devnet. Set SOLANA_RPC_URL to a devnet endpoint.`,
      );
    }

    const wallet = new Wallet(AUTHORITY);

    provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    anchor.setProvider(provider);
    program = new Program(idl as anchor.Idl, provider) as Program<Opal>;

    token = await buildTokenEnv(connection);

    try {
      proto = await setupProtocol(program, token, AUTHORITY);
    } catch (_e) {
      const [configPda] = PublicKey.findProgramAddressSync(
        [SEEDS.PROTOCOL_CONFIG],
        program.programId,
      );
      const treasuryAta = (
        await getOrCreateAssociatedTokenAccount(
          connection,
          token.mintAuthority,
          token.mint,
          token.treasury,
          true,
          undefined,
          { commitment: "confirmed" },
          TOKEN_PROGRAM_ID,
        )
      ).address;
      proto = { configPda, authority: AUTHORITY, treasuryAta };
    }

    ctx = new TestContext(program, provider, connection, token, proto);
  });

  it(
    "undisputed path: creates, waits, finalizes with correct payouts on devnet",
    { timeout: 120_000 },
    async () => {
      const a = ctx.newAssertion();
      const bond = 200;
      const asserterStart = await balanceOf(connection, token.asserterAta);
      const treasuryStart = await balanceOf(connection, proto.treasuryAta);

      await ctx.createAssertion(a, "Bitcoin > $100k by 2026", bond, "hash123");

      const acc = await ctx.fetchAssertion(a);
      expect(acc.state).toBe(STATE.ASSERTED);
      expect(acc.disputeCount).toBe(0);
      expect(acc.outcome).toBe(OUTCOME.NONE);

      await sleep(5000); // 3s liveness window + 2s buffer

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
    },
  );

  it(
    "LLM resolution path: resolves via real Switchboard oracle on devnet",
    { timeout: 300_000 },
    async () => {
      const a = ctx.newAssertion();
      const bond = 200;

      // 1. Create assertion
      await ctx.createAssertion(a, "ETH flips BTC", bond, "abc");

      // 2. Dispute within liveness (3s)
      await ctx.disputeAssertion(a);
      const llmRound = await ctx.fetchLlmRound(a);
      expect(llmRound.outcome).toBe(OUTCOME.NONE);

      // 3. Set up Switchboard feed and configure LLM round
      const { feedHash, queuePubkey } = await setupSwitchboardFeed(
        ctx.provider.wallet.payer,
        connection,
      );
      await configureLlmRoundForSwitchboard(ctx, a, feedHash, queuePubkey, 300);

      // 4. Generate a predictable prompt hash (SHA-256 of test prompt)
      // For devnet testing, use a fixed 32-byte array
      const promptHash = new Array(32).fill(0);
      promptHash[0] = 1; // non-zero to distinguish from unset

      // 5. Build and send the 2-ix Switchboard resolution transaction
      const tx = await buildSwitchboardResolutionTx(
        ctx,
        a,
        feedHash,
        queuePubkey,
        300,
        promptHash,
      );

      // Sign with authority (fee payer and submitter)
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signedTx = await ctx.provider.wallet.signTransaction(tx);
      const txSig = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });
      await connection.confirmTransaction(txSig, "confirmed");

      // 6. Verify LLM outcome was set
      const updatedRound = await ctx.fetchLlmRound(a);
      expect(updatedRound.outcome).not.toBe(OUTCOME.NONE);
      expect(updatedRound.outcome).toBeLessThanOrEqual(3); // valid outcome codes 0-3

      const updatedAssertion = await ctx.fetchAssertion(a);
      expect(updatedAssertion.state).toBe(STATE.ASSERTED_LLM);

      // 7. Wait for challenge window to close (30s + 5s buffer)
      await sleep(35000);

      // 8. Finalize LLM resolution
      const asserterStart = await balanceOf(connection, token.asserterAta);
      const llmDisputerStart = await balanceOf(connection, token.llmDisputerAta);
      const treasuryStart = await balanceOf(connection, proto.treasuryAta);

      await ctx.finalizeLlmResolution(a);

      // 9. Verify resolution
      const resolved = await ctx.fetchAssertion(a);
      expect(resolved.state).toBe(STATE.RESOLVED);
      expect(resolved.finalizedAt.toNumber()).toBeGreaterThan(0);

      // 10. Verify payouts
      // dispute_bond = bond * 5000 / 10000 = 100
      // fee = bond * 250 / 10000 = 5
      const disputeBond = 100;
      const fee = 5;

      // If LLM outcome is FALSE (1): disputer wins, gets dispute_bond + (assertion_bond - fee)
      // If LLM outcome is TRUE (0): asserter wins, gets assertion_bond - fee
      if (resolved.outcome === OUTCOME.FALSE) {
        // Disputer wins
        expect(await balanceOf(connection, token.llmDisputerAta)).toBe(
          llmDisputerStart + disputeBond + (bond - fee),
        );
        expect(await balanceOf(connection, token.asserterAta)).toBe(
          asserterStart - bond + (bond - fee), // doesn't change more
        );
      } else {
        // Asserter wins (outcome TRUE)
        expect(await balanceOf(connection, token.asserterAta)).toBe(
          asserterStart - bond + (bond - fee) + (bond - fee) - disputeBond,
        );
      }
      // Treasury always gets fee
      expect(await balanceOf(connection, proto.treasuryAta)).toBe(
        treasuryStart + fee,
      );
    },
  );

  it(
    "full escalation path: disputes, LLM, challenges, votes, resolves on devnet",
    { timeout: 600_000 },
    async () => {
      const a = ctx.newAssertion();
      const bond = 200;
      const disputeBond = 100; // bond * 5000 / 10000
      const voteDisputeBond = 60; // bond * 3000 / 10000
      const fee = 5; // bond * 250 / 10000

      // 1. Create assertion
      await ctx.createAssertion(a, "SOL flips ETH in 2026", bond, "hash456");

      // 2. Dispute within liveness window (3s)
      await ctx.disputeAssertion(a);

      // 3. Configure Switchboard and submit LLM resolution
      const { feedHash, queuePubkey } = await setupSwitchboardFeed(
        ctx.provider.wallet.payer,
        connection,
      );
      await configureLlmRoundForSwitchboard(ctx, a, feedHash, queuePubkey, 300);

      const promptHash = new Array(32).fill(0) as number[];
      promptHash[1] = 1;

      const tx = await buildSwitchboardResolutionTx(
        ctx, a, feedHash, queuePubkey, 300, promptHash,
      );
      tx.feePayer = ctx.provider.wallet.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signedTx = await ctx.provider.wallet.signTransaction(tx);
      const txSig = await connection.sendRawTransaction(
        signedTx.serialize(), { skipPreflight: true, maxRetries: 3 }
      );
      await connection.confirmTransaction(txSig, "confirmed");

      // 4. Wait for challenge window (30s + 5s buffer)
      await sleep(35000);

      // 5. Capture starting balances
      const asserterStart = await balanceOf(connection, token.asserterAta);
      const llmDisputerStart = await balanceOf(connection, token.llmDisputerAta);
      const voteDisputerStart = await balanceOf(connection, token.voteDisputerAta);
      const treasuryStart = await balanceOf(connection, proto.treasuryAta);

      // 6. Challenge LLM resolution
      await ctx.challengeLlmResolution(a);
      const voteDispute = await ctx.fetchVoteDispute(a);
      expect(voteDispute.bondAmountPusd.toNumber()).toBe(voteDisputeBond);

      // 7. Open vote
      await ctx.openVote(a);
      const voteRound = await ctx.fetchVoteRound(a);
      expect(voteRound.delegated).toBe(1);

      // 8. Wait for voting window (60s setup + 300s voting + 10s buffer = 370s)
      await sleep(370000);

      // 9. Finalize vote resolution (authority supplies outcome)
      // Use OUTCOME_FALSE so LLM disputer wins stage A, vote disputer correct (challenged LLM)
      await ctx.finalizeVoteResolutionPlaceholder(a, OUTCOME.FALSE);

      // 10. Verify resolved
      const resolved = await ctx.fetchAssertion(a);
      expect(resolved.state).toBe(STATE.RESOLVED);
      expect(resolved.outcome).toBe(OUTCOME.FALSE);
      expect(resolved.finalizedAt.toNumber()).toBeGreaterThan(0);

      // 11. Both disputes settled
      const llmDisputeFinal = await ctx.fetchLlmDispute(a);
      const voteDisputeFinal = await ctx.fetchVoteDispute(a);
      expect(llmDisputeFinal.settlementResolution).not.toBe(OUTCOME.NONE);
      expect(voteDisputeFinal.settlementResolution).not.toBe(OUTCOME.NONE);

      // 12. Verify payouts (all 4 parties)
      // Stage A: LLM dispute — outcome is FALSE, so LLM disputer WINS
      // Stage B: Vote dispute — challenged LLM, final=FALSE, LLM was right
      // Vote disputer bond → goes to LLM stage winner minus fee
      // LLM disputer gets: disputeBond + (bond - fee) + (voteDisputeBond - fee)
      const llmDisputerExpected = llmDisputerStart + disputeBond + (bond - fee) + (voteDisputeBond - fee);
      expect(await balanceOf(connection, token.llmDisputerAta)).toBe(llmDisputerExpected);

      // Vote disputer: bond is slashed (goes to stage winner + treasury)
      expect(await balanceOf(connection, token.voteDisputerAta)).toBe(
        voteDisputerStart - voteDisputeBond,
      );

      // Treasury: gets fees from both stages
      const treasuryExpected = treasuryStart + fee + fee;
      expect(await balanceOf(connection, proto.treasuryAta)).toBe(treasuryExpected);
    },
  );
});
});
