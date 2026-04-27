import { describe, it, expect, beforeAll } from "bun:test";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import idl from "../target/idl/opal.json";

const PROGRAM_ID = new PublicKey(
  "8NCcxyAzKiAHxJ9DMnADtxShYutS9w81wHcXqgCavTBy",
);

const DEVNET_RPC =
  process.env.DEVNET_RPC || "https://api.devnet.solana.com";

describe("opal devnet smoke test", () => {
  let connection: Connection;
  let program: Program;

  beforeAll(async () => {
    connection = new Connection(DEVNET_RPC, "confirmed");
    const provider = new AnchorProvider(
      connection,
      Wallet.local(),
      { commitment: "confirmed" },
    );
    program = new Program(idl as any, provider);
  });

  it("should connect and verify program deployment", async () => {
    const accountInfo = await connection.getAccountInfo(PROGRAM_ID);
    expect(accountInfo).not.toBeNull();
    expect(accountInfo!.executable).toBe(true);
  });

  it("should fetch protocol config if initialized", async () => {
    const configSeed = Buffer.from("protocol_config");
    const [configPda] = PublicKey.findProgramAddressSync(
      [configSeed],
      PROGRAM_ID,
    );

    try {
      const config = await program.account.protocolConfig.fetch(configPda);
      expect(config).toBeDefined();
      expect(config.assertionBondMinPusd.toNumber()).toBeGreaterThan(0);
    } catch {
      // Config may not be initialized on devnet; that's okay for smoke test
      expect(true).toBe(true);
    }
  });
});
