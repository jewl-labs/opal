import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import type { Opal } from "../target/types/opal";
import * as fs from "fs";

const CONFIG = {
  rpcEndpoint: process.env.RPC_ENDPOINT || "https://api.devnet.solana.com",
  walletPath: process.env.WALLET_PATH || "~/.config/solana/id.json",
  programId: process.env.PROGRAM_ID || "8NCcxyAzKiAHxJ9DMnADtxShYutS9w81wHcXqgCavTBy",
};

function loadWallet(path: string): Keypair {
  const resolvedPath = path.replace("~", process.env.HOME || "");
  const secretKey = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

async function main() {
  const wallet = loadWallet(CONFIG.walletPath);
  const connection = new Connection(CONFIG.rpcEndpoint, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});

  const programId = new PublicKey(CONFIG.programId);
  const idl = JSON.parse(fs.readFileSync(new URL("../target/idl/opal.json", import.meta.url).pathname, "utf-8"));
  const program = new anchor.Program<Opal>(idl, provider);

  const claim = "Narendra Modi won the 2024 US Presidential elections";
  const assertionId = Keypair.generate().publicKey;
  const bond = 200;

  console.log("============================================================");
  console.log("Creating Test Assertion");
  console.log("============================================================");
  console.log(`Claim: ${claim}`);
  console.log(`Bond: ${bond} PUSD`);
  console.log(`Assertion ID: ${assertionId.toBase58()}`);

  try {
    const [protocolConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_config")],
      programId
    );

    const [assertion] = PublicKey.findProgramAddressSync(
      [Buffer.from("assertion"), assertionId.toBuffer()],
      programId
    );

    const [bondVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("bond_vault"), assertionId.toBuffer()],
      programId
    );

    console.log("\n✓ Assertion created");
    console.log(`  Use this ID for the relayer:`);
    console.log(`  ASSERTION_ID=${assertionId.toBase58()}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
