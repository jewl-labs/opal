import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Connection,
  Keypair,
  VersionedTransaction,
  TransactionMessage,
  ComputeBudgetProgram,
  AddressLookupTableProgram,
} from "@solana/web3.js";
import {
  Queue,
  PullFeed,
  asV0Tx,
} from "@switchboard-xyz/on-demand";
import { Opal } from "../target/types/opal";
import * as fs from "fs";

const CONFIG = {
  rpcEndpoint: process.env.RPC_ENDPOINT || "https://api.devnet.solana.com",
  walletPath: process.env.WALLET_PATH || "~/.config/solana/id.json",
  programId: process.env.PROGRAM_ID || "8NCcxyAzKiAHxJ9DMnADtxShYutS9w81wHcXqgCavTBy",
  queueKey:
    process.env.QUEUE_KEY || "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7",
  assertionId: process.env.ASSERTION_ID || "",
  computeUnitPrice: 200_000,
};

function loadWallet(path: string): Keypair {
  const resolvedPath = path.replace("~", process.env.HOME || "");
  const secretKey = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

async function fetchFeedUpdate(
  queue: Queue,
  feedKey: PublicKey,
  claimStatement: string,
  auxiliaryData: string
): Promise<any> {
  console.log("\n[Phase 1] Fetching feed update from Switchboard...");

  const feed = new PullFeed(queue.program, feedKey);

  const updateIx = await feed.fetchUpdateIx({
    numSignatures: 3,
    variableOverrides: {
      CLAIM_STATEMENT: claimStatement,
      AUXILIARY_DATA: auxiliaryData,
    },
  });

  console.log("✓ Update instruction created");
  return updateIx;
}

async function submitVerdict(
  program: anchor.Program<Opal>,
  wallet: Keypair,
  programId: PublicKey,
  updateIx: any,
  assertionId: string
): Promise<string> {
  console.log("\n[Phase 2] Bundling and submitting verdict on-chain...");

  const connection = new Connection(CONFIG.rpcEndpoint, "confirmed");

  const assertionKey = new PublicKey(assertionId);
  const [assertion] = PublicKey.findProgramAddressSync(
    [Buffer.from("assertion"), assertionKey.toBuffer()],
    programId
  );

  const [protocolConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    programId
  );

  const [llmResolutionRound] = PublicKey.findProgramAddressSync(
    [Buffer.from("llm_round"), assertion.toBuffer()],
    programId
  );

  const roundAccount = await program.account.llmResolutionRound.fetch(
    llmResolutionRound
  );
  const feedKey = roundAccount.councilFeeds[0];

  const submitIx = await program.methods
    .submitLlmResolution()
    .accounts({
      payer: wallet.publicKey,
      protocolConfig,
      assertion,
      llmResolutionRound,
      feed0: feedKey,
    })
    .instruction();

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");

  const messageV0 = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: CONFIG.computeUnitPrice,
      }),
      updateIx,
      submitIx,
    ],
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(messageV0);
  versionedTx.sign([wallet]);

  const txSig = await connection.sendTransaction(versionedTx, {
    maxRetries: 3,
  });

  console.log(`✓ Verdict submitted on-chain`);
  console.log(`  Transaction: ${txSig}`);

  await connection.confirmTransaction(
    {
      signature: txSig,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed"
  );

  console.log(`  Confirmed!`);

  return txSig;
}

async function main() {
  if (!CONFIG.assertionId) {
    console.error("Error: ASSERTION_ID environment variable is required");
    console.error("Usage: ASSERTION_ID=<id> CLAIM_STATEMENT=<...> AUXILIARY_DATA=<...> npx ts-node relayer.ts");
    process.exit(1);
  }

  const claimStatement = process.env.CLAIM_STATEMENT || "Test claim";
  const auxiliaryData = process.env.AUXILIARY_DATA || "";

  const wallet = loadWallet(CONFIG.walletPath);
  const connection = new Connection(CONFIG.rpcEndpoint, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});

  const programId = new PublicKey(CONFIG.programId);
  const program = new anchor.Program<Opal>(
    require("../target/idl/opal.json"),
    programId,
    provider
  );

  const queueKey = new PublicKey(CONFIG.queueKey);
  const queue = new Queue({
    program: {
      provider,
      programId: new PublicKey("A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w"),
    },
    publicKey: queueKey,
  });

  console.log("=".repeat(60));
  console.log("Opal LLM Resolution Relayer");
  console.log("=".repeat(60));

  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("Program:", programId.toBase58());
  console.log("Assertion ID:", CONFIG.assertionId);
  console.log("Queue:", queueKey.toBase58());

  try {
    const assertionKey = new PublicKey(CONFIG.assertionId);
    const [assertion] = PublicKey.findProgramAddressSync(
      [Buffer.from("assertion"), assertionKey.toBuffer()],
      programId
    );

    const [llmResolutionRound] = PublicKey.findProgramAddressSync(
      [Buffer.from("llm_round"), assertion.toBuffer()],
      programId
    );

    const roundAccount = await program.account.llmResolutionRound.fetch(
      llmResolutionRound
    );
    const feedKey = roundAccount.councilFeeds[0];

    console.log("Feed:", feedKey.toBase58());

    const updateIx = await fetchFeedUpdate(
      queue,
      feedKey,
      claimStatement,
      auxiliaryData
    );

    const txSig = await submitVerdict(
      program,
      wallet,
      programId,
      updateIx,
      CONFIG.assertionId
    );

    console.log("\n" + "=".repeat(60));
    console.log("✓ Resolution complete");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("✗ Relayer failed:");
    console.error(error);
    console.error("=".repeat(60));
    process.exit(1);
  }
}

main();
