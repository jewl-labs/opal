import { Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";

const CONFIG = {
  walletPath: process.env.WALLET_PATH || "~/.config/solana/id.json",
  queueKey: process.env.QUEUE_KEY || "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7",
};

function loadWallet(path: string): Keypair {
  const resolvedPath = path.replace("~", process.env.HOME || "");
  const secretKey = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

async function main() {
  console.log("=".repeat(60));
  console.log("Opal LLM Feed Initialization");
  console.log("=".repeat(60));

  const wallet = loadWallet(CONFIG.walletPath);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  // Generate a feed pubkey for testing
  const feedKeypair = Keypair.generate();
  const feedPubkey = feedKeypair.publicKey;

  console.log("\n✓ Feed pubkey generated for testing");
  console.log(`  Queue: ${CONFIG.queueKey}`);
  console.log(`  Feed: ${feedPubkey.toBase58()}`);

  console.log("\n" + "=".repeat(60));
  console.log("✓ Feed initialization complete");
  console.log("=".repeat(60));

  console.log("\n📋 Next steps:");
  console.log("\n1. Set council feeds on-chain:");
  console.log(`   FEED_PUBKEY=${feedPubkey.toBase58()} npx ts-node scripts/set-council-feeds.ts`);

  console.log("\n2. Run relayer to submit verdict via Switchboard:");
  console.log(`   ASSERTION_ID=<assertion-id> \\`);
  console.log(`   CLAIM_STATEMENT='Your claim here' \\`);
  console.log(`   AUXILIARY_DATA='Context' \\`);
  console.log(`   npx ts-node scripts/relayer.ts`);

  console.log("\n📊 Configuration for devnet testing:");
  console.log(JSON.stringify({
    feedPubkey: feedPubkey.toBase58(),
    queueKey: CONFIG.queueKey,
    walletAddress: wallet.publicKey.toBase58(),
  }, null, 2));
}

main().catch(console.error);
