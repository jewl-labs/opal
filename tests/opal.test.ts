import {
  assertAccountExists,
  createKeyPairSignerFromBytes,
  type Address,
  type KeyPairSigner,
  type TransactionSigner,
} from "@solana/kit";
import { describe, it, expect, beforeAll } from "bun:test";
import {
  OPAL_PROGRAM_ADDRESS,
  COUNTER_DISCRIMINATOR,
  getCounterDecoder,
  getDecrementInstruction,
  getIncrementInstruction,
  getInitializeInstruction,
} from "@client/index";
import { connect, getPDAAndBump, type Connection } from "solana-kite";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("counter", async () => {
  let authority: KeyPairSigner | TransactionSigner;
  let counterPda: Address;

  let connection: Connection;

  let getCounter: () => Promise<bigint>;
  const CLUSTER = process.env.CLUSTER?.toLowerCase() || "localnet";

  beforeAll(async () => {
    // Bun is so fast, the websocket connection may not be ready yet
    await sleep(2000);
    connection = connect(CLUSTER);

    authority =
      process.env.KEYPAIR_BYTES && CLUSTER === "devnet"
        ? await createKeyPairSignerFromBytes(
            new Uint8Array(JSON.parse(process.env.KEYPAIR_BYTES)),
          )
        : await connection.createWallet();

    const counterPDAAndBump = await getPDAAndBump(OPAL_PROGRAM_ADDRESS, [
      Buffer.from("counter"),
    ]);
    counterPda = counterPDAAndBump.pda;

    const getCounters = connection.getAccountsFactory(
      OPAL_PROGRAM_ADDRESS,
      COUNTER_DISCRIMINATOR,
      getCounterDecoder(),
    );

    getCounter = async () => {
      const counters = await getCounters();
      expect(counters.length).toBe(1);

      const counter = counters[0]!;
      expect(counter.exists).toBe(true);

      assertAccountExists(counter);
      return counter.data.value;
    };
  });

  it("should inititalize", async () => {
    const initIx = getInitializeInstruction({
      user: authority,
      counter: counterPda,
    });

    const result = await connection.sendTransactionFromInstructions({
      feePayer: authority,
      instructions: [initIx],
      commitment: "confirmed",
    });

    expect(result).toBeTruthy();
  });

  it("should increment", async () => {
    const incrementIx = getIncrementInstruction({
      user: authority,
      counter: counterPda,
    });

    const result = await connection.sendTransactionFromInstructions({
      feePayer: authority,
      instructions: [incrementIx],
      commitment: "confirmed",
    });

    expect(result).toBeTruthy();

    const counter = await getCounter();
    expect(counter).toBe(1n);
  });

  it("should decrement", async () => {
    const decrementIx = getDecrementInstruction({
      user: authority,
      counter: counterPda,
    });

    const result = await connection.sendTransactionFromInstructions({
      feePayer: authority,
      instructions: [decrementIx],
      commitment: "confirmed",
    });

    expect(result).toBeTruthy();

    const counter = await getCounter();
    expect(counter).toBe(0n);
  });
});
