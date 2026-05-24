import * as anchor from "@coral-xyz/anchor";
import type { Opal } from "../target/types/opal";
import * as fs from "fs";

const CONFIG = {
  rpcEndpoint: process.env.RPC_ENDPOINT || "https://api.devnet.solana.com",
  walletPath: process.env.WALLET_PATH || "~/.config/solana/id.json",
  programId: process.env.PROGRAM_ID || "8NCcxyAzKiAHxJ9DMnADtxShYutS9w81wHcXqgCavTBy",
  feedPubkey: process.env.FEED_PUBKEY || "",
};

function loadWallet(path: string): anchor.web3.Keypair {
  const resolvedPath = path.replace("~", process.env.HOME || "");
  const secretKey = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

async function main() {
  if (!CONFIG.feedPubkey) {
    console.error("Error: FEED_PUBKEY environment variable is required");
    console.error("Usage: FEED_PUBKEY=<pubkey> npx ts-node set-council-feeds.ts");
    process.exit(1);
  }

  let feedKey: anchor.web3.PublicKey;
  try {
    feedKey = new anchor.web3.PublicKey(CONFIG.feedPubkey);
  } catch {
    console.error("Error: Invalid FEED_PUBKEY format");
    process.exit(1);
  }

  const wallet = loadWallet(CONFIG.walletPath);
  const connection = new anchor.web3.Connection(CONFIG.rpcEndpoint, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});

  const programId = new anchor.web3.PublicKey(CONFIG.programId);
  const idl = JSON.parse(fs.readFileSync("target/idl/opal.json", "utf-8"));
  const program = new anchor.Program<Opal>(
    idl as any,
    programId as any,
    provider as any
  );

  console.log("=".repeat(60));
  console.log("Setting Council Feeds (LLM Feed)");
  console.log("=".repeat(60));

  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("Program:", programId.toBase58());
  console.log("Feed Pubkey:", feedKey.toBase58());

  const [protocolConfig] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    programId
  );

  console.log("Protocol Config:", protocolConfig.toBase58());

  const feeds = [feedKey];

  try {
    const tx = await program.methods
      .setCouncilFeeds({
        feeds,
      })
      .accounts({
        authority: wallet.publicKey,
        protocolConfig,
      } as any)
      .rpc();

    console.log("\n✓ Successfully set council feeds");
    console.log("Transaction:", tx);
  } catch (error) {
    console.error("\n✗ Failed to set council feeds:");
    console.error(error);
    process.exit(1);
  }
}

main().catch(err => { console.error("CLI failure:", err); process.exit(1); });
