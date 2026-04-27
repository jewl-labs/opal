import { describe, it, expect, beforeAll } from "bun:test";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import idl from "../target/idl/opal.json";

const PROGRAM_ID = new PublicKey(
  "8NCcxyAzKiAHxJ9DMnADtxShYutS9w81wHcXqgCavTBy",
);
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

const PROTOCOL_CONFIG_SEED = Buffer.from("protocol_config");
const ASSERTION_SEED = Buffer.from("assertion");
const BOND_VAULT_SEED = Buffer.from("bond_vault");
const LLM_DISPUTE_SEED = Buffer.from("llm_dispute");
const VOTE_DISPUTE_SEED = Buffer.from("vote_dispute");
const LLM_ROUND_SEED = Buffer.from("llm_round");
const VOTE_ROUND_SEED = Buffer.from("vote_round");

const RPC_URL = "http://127.0.0.1:8899";

async function callCheatcode(
  connection: Connection,
  method: string,
  params: unknown[],
) {
  const res = await fetch(connection.rpcEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = (await res.json()) as { error?: unknown; result?: unknown };
  if (data.error) {
    throw new Error(`${method}: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}

async function setupMint(
  connection: Connection,
  mint: PublicKey,
  authority: PublicKey,
) {
  await callCheatcode(connection, "surfnet_setMintAccount", [
    {
      mint: mint.toBase58(),
      decimals: 6,
      mintAuthority: authority.toBase58(),
      supply: "1000000000000000",
    },
  ]);
}

async function setupTokenAccount(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  amount: string,
) {
  await callCheatcode(connection, "surfnet_setTokenAccount", [
    {
      owner: owner.toBase58(),
      mint: mint.toBase58(),
      tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
      update: { amount, state: "initialized" },
    },
  ]);
}

async function fundAccount(
  connection: Connection,
  pubkey: PublicKey,
  lamports: number,
) {
  await callCheatcode(connection, "surfnet_setAccount", [
    { pubkey: pubkey.toBase58(), lamports },
  ]);
}

async function timeTravelSeconds(connection: Connection, seconds: number) {
  const clock = (await callCheatcode(connection, "surfnet_getClock", [])) as {
    timestamp: number;
  };
  await callCheatcode(connection, "surfnet_timeTravel", [
    { timestamp: clock.timestamp + seconds },
  ]);
}

function derivePDAs(assertionId: PublicKey, programId: PublicKey) {
  const [assertion] = PublicKey.findProgramAddressSync(
    [ASSERTION_SEED, assertionId.toBuffer()],
    programId,
  );
  const [bondVault] = PublicKey.findProgramAddressSync(
    [BOND_VAULT_SEED, assertionId.toBuffer()],
    programId,
  );
  const [llmDispute] = PublicKey.findProgramAddressSync(
    [LLM_DISPUTE_SEED, assertion.toBuffer()],
    programId,
  );
  const [llmRound] = PublicKey.findProgramAddressSync(
    [LLM_ROUND_SEED, assertion.toBuffer()],
    programId,
  );
  const [voteDispute] = PublicKey.findProgramAddressSync(
    [VOTE_DISPUTE_SEED, assertion.toBuffer()],
    programId,
  );
  const [voteRound] = PublicKey.findProgramAddressSync(
    [VOTE_ROUND_SEED, assertion.toBuffer()],
    programId,
  );
  return {
    assertion,
    bondVault,
    llmDispute,
    llmRound,
    voteDispute,
    voteRound,
  };
}

interface TokenEnv {
  mint: PublicKey;
  mintAuthority: Keypair;
  treasury: PublicKey;
  asserter: Keypair;
  asserterPusd: PublicKey;
  llmDisputer: Keypair;
  llmDisputerPusd: PublicKey;
  voteDisputer: Keypair;
  voteDisputerPusd: PublicKey;
}

interface ProtocolEnv {
  configPda: PublicKey;
  authority: Keypair;
}

async function buildTokenEnv(connection: Connection): Promise<TokenEnv> {
  const mint = Keypair.generate().publicKey;
  const mintAuthority = Keypair.generate();
  const treasury = Keypair.generate();
  const asserter = Keypair.generate();
  const llmDisputer = Keypair.generate();
  const voteDisputer = Keypair.generate();

  await setupMint(connection, mint, mintAuthority.publicKey);

  for (const kp of [treasury, asserter, llmDisputer, voteDisputer]) {
    await fundAccount(connection, kp.publicKey, 10_000_000_000);
  }

  await setupTokenAccount(
    connection,
    treasury.publicKey,
    mint,
    "1000000000000",
  );
  await setupTokenAccount(
    connection,
    asserter.publicKey,
    mint,
    "1000000000000",
  );
  await setupTokenAccount(
    connection,
    llmDisputer.publicKey,
    mint,
    "1000000000000",
  );
  await setupTokenAccount(
    connection,
    voteDisputer.publicKey,
    mint,
    "1000000000000",
  );

  return {
    mint,
    mintAuthority,
    treasury: treasury.publicKey,
    asserter,
    asserterPusd: await getAssociatedTokenAddress(mint, asserter.publicKey),
    llmDisputer,
    llmDisputerPusd: await getAssociatedTokenAddress(
      mint,
      llmDisputer.publicKey,
    ),
    voteDisputer,
    voteDisputerPusd: await getAssociatedTokenAddress(
      mint,
      voteDisputer.publicKey,
    ),
  };
}

async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
): Promise<PublicKey> {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  );
  return ata;
}

async function setupProtocol(
  program: Program,
  token: TokenEnv,
  authority: Keypair,
): Promise<ProtocolEnv> {
  const [configPda] = PublicKey.findProgramAddressSync(
    [PROTOCOL_CONFIG_SEED],
    PROGRAM_ID,
  );

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
      livenessWindowSeconds: new BN(86400),
      llmChallengeWindowSeconds: new BN(43200),
      voteSetupWindowSeconds: new BN(3600),
      votingWindowSeconds: new BN(86400),
    })
    .accounts({
      authority: authority.publicKey,
      protocolConfig: configPda,
      pusdMint: token.mint,
      treasuryPusd: await getAssociatedTokenAddress(
        token.mint,
        token.treasury,
      ),
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc({ commitment: "confirmed" });

  return { configPda, authority };
}

describe("opal localnet tests", () => {
  let connection: Connection;
  let provider: AnchorProvider;
  let program: Program;

  beforeAll(async () => {
    connection = new Connection(RPC_URL, "confirmed");

    const payer = Keypair.generate();
    await fundAccount(connection, payer.publicKey, 100_000_000_000);

    const wallet = new Wallet(payer);
    provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    program = new Program(idl as any, provider);
  });

  describe("undisputed path", () => {
    let token: TokenEnv;
    let proto: ProtocolEnv;
    let treasuryAta: PublicKey;

    beforeAll(async () => {
      token = await buildTokenEnv(connection);
      proto = await setupProtocol(program, token, provider.wallet.payer);
      treasuryAta = await getAssociatedTokenAddress(token.mint, token.treasury);
    });

    it("should init, create assertion, and finalize undisputed", async () => {
      const assertionId = Keypair.generate().publicKey;
      const { assertion, bondVault } = derivePDAs(assertionId, PROGRAM_ID);

      await program.methods
        .createAssertion({
          assertionId,
          statement: "Bitcoin > $100k by 2026",
          auxiliaryHash: "hash123",
          assertionBondAmountPusd: new BN(200),
        })
        .accounts({
          asserter: token.asserter.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion,
          bondVault,
          asserterPusd: token.asserterPusd,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([token.asserter])
        .rpc({ commitment: "confirmed" });

      const acc = await program.account.assertionAccount.fetch(assertion);
      expect(acc.state.asserted).toBeDefined();
      expect(acc.disputeCount).toBe(0);
      expect(acc.outcome).toBeNull();

      await timeTravelSeconds(connection, 86400 * 2);

      await program.methods
        .finalizeUndisputed()
        .accounts({
          finalizer: provider.wallet.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion,
          bondVault,
          asserterPusd: token.asserterPusd,
          treasuryPusd: treasuryAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed" });

      const resolved = await program.account.assertionAccount.fetch(assertion);
      expect(resolved.state.resolved).toBeDefined();
      expect(resolved.outcome).toEqual({ true: {} });
      expect(resolved.finalizedAt).not.toBeNull();
    });
  });

  describe("llm resolution path", () => {
    let token: TokenEnv;
    let proto: ProtocolEnv;
    let treasuryAta: PublicKey;

    beforeAll(async () => {
      token = await buildTokenEnv(connection);
      proto = await setupProtocol(program, token, provider.wallet.payer);
      treasuryAta = await getAssociatedTokenAddress(token.mint, token.treasury);
    });

    it("should resolve via llm round", async () => {
      const assertionId = Keypair.generate().publicKey;
      const {
        assertion,
        bondVault,
        llmDispute,
        llmRound,
      } = derivePDAs(assertionId, PROGRAM_ID);

      await program.methods
        .createAssertion({
          assertionId,
          statement: "ETH flips BTC",
          auxiliaryHash: "abc",
          assertionBondAmountPusd: new BN(200),
        })
        .accounts({
          asserter: token.asserter.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion,
          bondVault,
          asserterPusd: token.asserterPusd,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([token.asserter])
        .rpc({ commitment: "confirmed" });

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
          disputerPusd: token.llmDisputerPusd,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([token.llmDisputer])
        .rpc({ commitment: "confirmed" });

      let acc = await program.account.assertionAccount.fetch(assertion);
      expect(acc.state.pendingLlm).toBeDefined();
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
        .rpc({ commitment: "confirmed" });

      acc = await program.account.assertionAccount.fetch(assertion);
      expect(acc.state.assertedLlm).toBeDefined();

      const round = await program.account.llmResolutionRound.fetch(llmRound);
      expect(round.outcome).toEqual({ false: {} });
      expect(round.challengeDeadline).not.toBeNull();

      await timeTravelSeconds(connection, 86400 * 2);

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
          asserterPusd: token.asserterPusd,
          llmDisputerPusd: token.llmDisputerPusd,
          treasuryPusd: treasuryAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed" });

      const resolved = await program.account.assertionAccount.fetch(assertion);
      expect(resolved.state.resolved).toBeDefined();
      expect(resolved.outcome).toEqual({ false: {} });

      const dispute = await program.account.llmDisputeAccount.fetch(
        llmDispute,
      );
      expect(dispute.settlementResolution).toEqual({ false: {} });
    });
  });

  describe("full escalation path", () => {
    let token: TokenEnv;
    let proto: ProtocolEnv;
    let treasuryAta: PublicKey;

    beforeAll(async () => {
      token = await buildTokenEnv(connection);
      proto = await setupProtocol(program, token, provider.wallet.payer);
      treasuryAta = await getAssociatedTokenAddress(token.mint, token.treasury);
    });

    it("should escalate to vote resolution", async () => {
      const assertionId = Keypair.generate().publicKey;
      const {
        assertion,
        bondVault,
        llmDispute,
        llmRound,
        voteDispute,
        voteRound,
      } = derivePDAs(assertionId, PROGRAM_ID);

      await program.methods
        .createAssertion({
          assertionId,
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
          asserterPusd: token.asserterPusd,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([token.asserter])
        .rpc({ commitment: "confirmed" });

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
          disputerPusd: token.llmDisputerPusd,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([token.llmDisputer])
        .rpc({ commitment: "confirmed" });

      await program.methods
        .submitMockLlmResolution({ outcomeCode: 0 })
        .accounts({
          authority: proto.authority.publicKey,
          protocolConfig: proto.configPda,
          assertion,
          llmResolutionRound: llmRound,
        })
        .signers([proto.authority])
        .rpc({ commitment: "confirmed" });

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
          disputerPusd: token.voteDisputerPusd,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([token.voteDisputer])
        .rpc({ commitment: "confirmed" });

      let acc = await program.account.assertionAccount.fetch(assertion);
      expect(acc.state.pendingVote).toBeDefined();
      expect(acc.disputeCount).toBe(2);

      await program.methods
        .openVote()
        .accounts({
          authority: proto.authority.publicKey,
          protocolConfig: proto.configPda,
          assertion,
          voteResolutionRound: voteRound,
        })
        .signers([proto.authority])
        .rpc({ commitment: "confirmed" });

      acc = await program.account.assertionAccount.fetch(assertion);
      expect(acc.state.voting).toBeDefined();

      await timeTravelSeconds(connection, 86400 * 3);

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
          asserterPusd: token.asserterPusd,
          llmDisputerPusd: token.llmDisputerPusd,
          voteDisputerPusd: token.voteDisputerPusd,
          treasuryPusd: treasuryAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([proto.authority])
        .rpc({ commitment: "confirmed" });

      const resolved = await program.account.assertionAccount.fetch(assertion);
      expect(resolved.state.resolved).toBeDefined();
      expect(resolved.outcome).toEqual({ false: {} });
      expect(resolved.finalizedAt).not.toBeNull();

      const llmDisp = await program.account.llmDisputeAccount.fetch(
        llmDispute,
      );
      expect(llmDisp.settlementResolution).not.toBeNull();

      const voteDisp = await program.account.voteDisputeAccount.fetch(
        voteDispute,
      );
      expect(voteDisp.settlementResolution).not.toBeNull();

      const vr = await program.account.voteResolutionRound.fetch(voteRound);
      expect(vr.finalOutcome).toEqual({ false: {} });
    });
  });

  describe("error cases", () => {
    let token: TokenEnv;
    let proto: ProtocolEnv;
    let treasuryAta: PublicKey;

    beforeAll(async () => {
      token = await buildTokenEnv(connection);
      proto = await setupProtocol(program, token, provider.wallet.payer);
      treasuryAta = await getAssociatedTokenAddress(token.mint, token.treasury);
    });

    it("should reject premature finalization and insufficient bond", async () => {
      const assertionId = Keypair.generate().publicKey;
      const { assertion, bondVault } = derivePDAs(assertionId, PROGRAM_ID);

      await program.methods
        .createAssertion({
          assertionId,
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
          asserterPusd: token.asserterPusd,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([token.asserter])
        .rpc({ commitment: "confirmed" });

      // Premature finalize should fail
      await expect(
        program.methods
          .finalizeUndisputed()
          .accounts({
            finalizer: provider.wallet.publicKey,
            protocolConfig: proto.configPda,
            pusdMint: token.mint,
            assertion,
            bondVault,
            asserterPusd: token.asserterPusd,
            treasuryPusd: treasuryAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc({ commitment: "confirmed" }),
      ).rejects.toThrow();

      // Insufficient bond should fail
      const id2 = Keypair.generate().publicKey;
      const { assertion: apda2, bondVault: bv2 } = derivePDAs(id2, PROGRAM_ID);

      await expect(
        program.methods
          .createAssertion({
            assertionId: id2,
            statement: "Fail",
            auxiliaryHash: "x",
            assertionBondAmountPusd: new BN(50),
          })
          .accounts({
            asserter: token.asserter.publicKey,
            protocolConfig: proto.configPda,
            pusdMint: token.mint,
            assertion: apda2,
            bondVault: bv2,
            asserterPusd: token.asserterPusd,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([token.asserter])
          .rpc({ commitment: "confirmed" }),
      ).rejects.toThrow();
    });
  });

  describe("config validation", () => {
    it("should reject zero bond minimum", async () => {
      const token = await buildTokenEnv(connection);
      const authority = Keypair.generate();
      await fundAccount(connection, authority.publicKey, 10_000_000_000);

      const [configPda] = PublicKey.findProgramAddressSync(
        [PROTOCOL_CONFIG_SEED],
        PROGRAM_ID,
      );

      const treasuryAta = await getAssociatedTokenAddress(
        token.mint,
        token.treasury,
      );

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
          .rpc({ commitment: "confirmed" }),
      ).rejects.toThrow();
    });
  });
});
