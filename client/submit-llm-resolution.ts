/**
 * Off-chain keeper that drives the LLM resolution flow for a disputed assertion.
 *
 * Flow:
 *   1. configure_llm_round  — commit Switchboard oracle params onchain (authority only)
 *   2. Wait for the resolver to produce a result (polled via Crossbar)
 *   3. submit_llm_resolution — bundle [sigVerifyIx, submitIx] in one transaction
 *
 * Usage:
 *   ts-node client/submit-llm-resolution.ts <assertionPubkey>
 *   # or import submitLlmResolution() from your keeper service
 */

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { CrossbarClient, Queue } from "@switchboard-xyz/on-demand";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type { Opal } from "../target/types/opal";

// Seeds (mirror constants.rs)
const SEEDS = {
  PROTOCOL_CONFIG: Buffer.from("protocol_config"),
  ASSERTION: Buffer.from("assertion"),
  LLM_ROUND: Buffer.from("llm_round"),
};

// Config
const RPC_URL = process.env.ANCHOR_PROVIDER_URL ?? "http://127.0.0.1:8899";
const RESOLVER_URL =
  process.env.RESOLVER_URL ?? "http://localhost:3001/resolve";

// Switchboard Devnet queue. Replace with mainnet queue pubkey for production.
const SWITCHBOARD_QUEUE = new PublicKey(
  process.env.SWITCHBOARD_QUEUE ?? "EYiAmGSdsT68S7GFmQ3seUEGbCvLdGUqgwn4KAaAnEG3",
);

// Maximum age in slots before oracle quote is considered stale (~150 s on devnet).
const MAX_STALENESS_SLOTS = BigInt(process.env.MAX_STALENESS_SLOTS ?? "250");

// Helpers

function loadKeypairFromFile(filePath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function derivePdas(assertionId: PublicKey, programId: PublicKey) {
  const [assertion] = PublicKey.findProgramAddressSync(
    [SEEDS.ASSERTION, assertionId.toBuffer()],
    programId,
  );
  const [llmRound] = PublicKey.findProgramAddressSync(
    [SEEDS.LLM_ROUND, assertion.toBuffer()],
    programId,
  );
  const [protocolConfig] = PublicKey.findProgramAddressSync(
    [SEEDS.PROTOCOL_CONFIG],
    programId,
  );
  return { assertion, llmRound, protocolConfig };
}

/**
 * Build a Switchboard pull-feed job that calls the resolver with the assertion
 * details and returns the outcome code as a plain integer.
 *
 * The resolver endpoint receives:
 *   POST /resolve
 *   { "statement": "...", "auxiliary_hash": "..." }
 *
 * and responds:
 *   { "outcome_code": 0 }   // 0=TRUE 1=FALSE 2=TOO_EARLY 3=UNRESOLVABLE
 *
 * The feed's job definition is serialized as JSON. The SHA-256 of this
 * canonical JSON is the feed hash committed onchain.
 */
function buildFeedJobDefinition(
  statement: string,
  auxiliaryHash: string,
): { jobJson: string; feedHash: Uint8Array } {
  const job = {
    tasks: [
      {
        httpTask: {
          url: RESOLVER_URL,
          method: "METHOD_POST",
          headers: [{ key: "Content-Type", value: "application/json" }],
          body: JSON.stringify({ statement, auxiliary_data: auxiliaryHash }),
        },
      },
      {
        jsonParseTask: {
          path: "$.outcome_code",
        },
      },
    ],
  };
  const jobJson = JSON.stringify(job);
  const feedHash = new Uint8Array(
    crypto.createHash("sha256").update(jobJson).digest(),
  );
  return { jobJson, feedHash };
}

// Step 1: Configure the LLM round with oracle params

export async function configureLlmRound(
  program: Program<Opal>,
  authority: Keypair,
  assertionId: PublicKey,
  feedHash: Uint8Array,
): Promise<void> {
  const { assertion, llmRound, protocolConfig } = derivePdas(
    assertionId,
    program.programId,
  );

  await program.methods
    .configureLlmRound({
      switchboardQueue: SWITCHBOARD_QUEUE,
      switchboardFeedHash: Array.from(feedHash) as unknown as number[] & { length: 32 },
      maxStalenessSlots: new BN(MAX_STALENESS_SLOTS.toString()),
    })
    .accounts({
      authority: authority.publicKey,
      protocolConfig,
      assertion,
      llmResolutionRound: llmRound,
    })
    .signers([authority])
    .rpc({ commitment: "confirmed" });

  console.log("configure_llm_round confirmed");
}

// Step 2: Submit the oracle-verified resolution

export async function submitLlmResolution(
  connection: Connection,
  program: Program<Opal>,
  submitter: Keypair,
  assertionId: PublicKey,
  promptHash: Uint8Array,
  feedHash: Uint8Array,
): Promise<string> {
  const { assertion, llmRound, protocolConfig } = derivePdas(
    assertionId,
    program.programId,
  );

  // Fetch oracle quote from Crossbar
  const crossbar = await CrossbarClient.default();
  const queue = await Queue.load(program.provider as AnchorProvider, SWITCHBOARD_QUEUE);

  // fetchUpdateIx returns [pullIx, luts] where pullIx is the secp256k1 verify
  // instruction the program reads via sysvar introspection at index 0.
  const feedHashHex = Buffer.from(feedHash).toString("hex");
  const [pullIx, luts] = await queue.fetchUpdateIx(crossbar, [feedHashHex]);

  // Build submitLlmResolution ix
  const submitIx = await program.methods
    .submitLlmResolution({
      promptHash: Array.from(promptHash) as unknown as number[] & { length: 32 },
    })
    .accounts({
      submitter: submitter.publicKey,
      protocolConfig,
      assertion,
      llmResolutionRound: llmRound,
      switchboardQueue: SWITCHBOARD_QUEUE,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

  // Bundle [sigVerifyIx (ix[0]), submitLlmResolutionIx (ix[1])].
  // QuoteVerifier.verify_instruction_at(0) reads the instruction at index 0.
  // VersionedTransaction is required so that address lookup tables (luts) can be applied.
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const v0Message = new TransactionMessage({
    payerKey: submitter.publicKey,
    recentBlockhash: blockhash,
    instructions: [pullIx, submitIx],
  }).compileToV0Message(luts);
  const versionedTx = new VersionedTransaction(v0Message);
  versionedTx.sign([submitter]);

  const sig = await connection.sendTransaction(versionedTx, {
    maxRetries: 5,
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  console.log("submit_llm_resolution confirmed:", sig);
  return sig;
}

// Full keeper flow

export async function runKeeperForAssertion(
  program: Program<Opal>,
  connection: Connection,
  authority: Keypair,
  assertionId: PublicKey,
): Promise<void> {
  const [assertionPda] = PublicKey.findProgramAddressSync(
    [SEEDS.ASSERTION, assertionId.toBuffer()],
    program.programId,
  );

  const assertionAcc = await program.account.assertionAccount.fetch(assertionPda);
  const statement = Buffer.from(assertionAcc.statement as Buffer)
    .toString("utf-8")
    .replace(/\0/g, "");
  const auxiliaryHash = Buffer.from(assertionAcc.auxiliaryHash as Buffer)
    .toString("utf-8")
    .replace(/\0/g, "");

  const { jobJson, feedHash } = buildFeedJobDefinition(statement, auxiliaryHash);

  const promptHash = new Uint8Array(
    crypto.createHash("sha256").update(jobJson).digest(),
  );

  await configureLlmRound(program, authority, assertionId, feedHash);
  await submitLlmResolution(connection, program, authority, assertionId, promptHash, feedHash);
}

// CLI entry point

async function main() {
  const assertionIdStr = process.argv[2];
  if (!assertionIdStr) {
    console.error("Usage: ts-node client/submit-llm-resolution.ts <assertionId>");
    process.exit(1);
  }
  const assertionId = new PublicKey(assertionIdStr);

  const walletPath =
    process.env.ANCHOR_WALLET ??
    path.join(os.homedir(), ".config/solana/id.json");
  const authority = loadKeypairFromFile(walletPath);

  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(
    connection,
    new Wallet(authority),
    AnchorProvider.defaultOptions(),
  );
  anchor.setProvider(provider);

  const idl = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../target/idl/opal.json"),
      "utf-8",
    ),
  );
  const program = new Program<Opal>(idl, provider);

  await runKeeperForAssertion(program, connection, authority, assertionId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
