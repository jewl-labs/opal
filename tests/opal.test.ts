import { describe, it, expect, beforeAll } from 'bun:test';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import * as anchor from '@anchor-lang/core';
import { Program, AnchorProvider, Wallet, BN } from '@anchor-lang/core';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
} from '@solana/spl-token';

import idl from '../target/idl/opal.json';
import type { Opal } from '../target/types/opal';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const BPF_UPGRADEABLE_LOADER_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

const SEEDS = {
  PROTOCOL_CONFIG: Buffer.from('protocol_config'),
  ASSERTION: Buffer.from('assertion'),
  BOND_VAULT: Buffer.from('bond_vault'),
  LLM_DISPUTE: Buffer.from('llm_dispute'),
  VOTE_DISPUTE: Buffer.from('vote_dispute'),
  LLM_ROUND: Buffer.from('llm_round'),
  VOTE_ROUND: Buffer.from('vote_round'),
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
  TOO_EARLY: 2,
  UNRESOLVABLE: 3,
  NONE: 255,
};

const RESOLUTION_SPEC_REFERENCE = `ar://${'A'.repeat(43)}#sha256=${'0'.repeat(64)}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function programDataAddress(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([programId.toBuffer()], BPF_UPGRADEABLE_LOADER_ID)[0];
}

async function fund(connection: Connection, pk: PublicKey, lamports: number) {
  const sig = await connection.requestAirdrop(pk, lamports);
  await connection.confirmTransaction(sig, 'confirmed');
}

async function balanceOf(connection: Connection, ata: PublicKey) {
  const acc = await getAccount(connection, ata, 'confirmed');
  return Number(acc.amount);
}

function derivePDAs(id: PublicKey, programId: PublicKey) {
  const [assertion] = PublicKey.findProgramAddressSync([SEEDS.ASSERTION, id.toBuffer()], programId);
  const [bondVault] = PublicKey.findProgramAddressSync(
    [SEEDS.BOND_VAULT, id.toBuffer()],
    programId
  );
  const [llmDispute] = PublicKey.findProgramAddressSync(
    [SEEDS.LLM_DISPUTE, assertion.toBuffer()],
    programId
  );
  const [llmRound] = PublicKey.findProgramAddressSync(
    [SEEDS.LLM_ROUND, assertion.toBuffer()],
    programId
  );
  const [voteDispute] = PublicKey.findProgramAddressSync(
    [SEEDS.VOTE_DISPUTE, assertion.toBuffer()],
    programId
  );
  const [voteRound] = PublicKey.findProgramAddressSync(
    [SEEDS.VOTE_ROUND, assertion.toBuffer()],
    programId
  );
  return { assertion, bondVault, llmDispute, llmRound, voteDispute, voteRound };
}

type TokenEnv = {
  mint: PublicKey;
  mintAuthority: Keypair;
  treasury: Keypair;
  asserter: Keypair;
  asserterAta: PublicKey;
  llmDisputer: Keypair;
  llmDisputerAta: PublicKey;
  voteDisputer: Keypair;
  voteDisputerAta: PublicKey;
};

async function buildTokenEnv(connection: Connection): Promise<TokenEnv> {
  const mintAuthority = Keypair.generate();
  const treasury = Keypair.generate();
  const asserter = Keypair.generate();
  const llmDisputer = Keypair.generate();
  const voteDisputer = Keypair.generate();

  for (const kp of [mintAuthority, treasury, asserter, llmDisputer, voteDisputer]) {
    await fund(connection, kp.publicKey, 10_000_000_000);
  }

  const mint = await createMint(connection, mintAuthority, mintAuthority.publicKey, null, 6);

  const atas = await Promise.all([
    getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, treasury.publicKey),
    getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, asserter.publicKey),
    getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, llmDisputer.publicKey),
    getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, voteDisputer.publicKey),
  ]);

  for (const acc of atas) {
    await mintTo(connection, mintAuthority, mint, acc.address, mintAuthority, 1_000_000_000_000);
  }

  return {
    mint,
    mintAuthority,
    treasury,
    asserter,
    asserterAta: atas[1].address,
    llmDisputer,
    llmDisputerAta: atas[2].address,
    voteDisputer,
    voteDisputerAta: atas[3].address,
  };
}

type ProtocolEnv = {
  configPda: PublicKey;
  authority: Keypair;
  resolver: Keypair;
  treasuryAta: PublicKey;
};

async function setupProtocol(
  program: Program<Opal>,
  token: TokenEnv,
  authority: Keypair
): Promise<ProtocolEnv> {
  const resolver = Keypair.generate();
  const [configPda] = PublicKey.findProgramAddressSync([SEEDS.PROTOCOL_CONFIG], program.programId);

  const treasuryAta = (
    await getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      token.mintAuthority,
      token.mint,
      token.treasury.publicKey
    )
  ).address;

  await program.methods
    .initializeProtocolConfig({
      resolver: resolver.publicKey,
      assertionBondMinPusd: new BN(100),
      llmDisputeBondRatioBps: 5000,
      voteDisputeBondRatioBps: 3000,
      protocolFeeBps: 250,
      llmDisputerRewardShareBps: 3000,
      voteDisputerRewardShareBps: 2500,
      voterRewardShareBps: 2500,
      treasuryShareBps: 2000,
      supermajorityBps: 6700,
      livenessWindowSeconds: new BN(2),
      llmChallengeWindowSeconds: new BN(3),
      voteSetupWindowSeconds: new BN(1),
      votingWindowSeconds: new BN(3),
      llmResolutionTimeoutSeconds: new BN(2),
    })
    .accounts({
      authority: authority.publicKey,
      protocolConfig: configPda,
      pusdMint: token.mint,
      treasuryPusd: treasuryAta,
      program: program.programId,
      programData: programDataAddress(program.programId),
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc({ commitment: 'confirmed' });

  return { configPda, authority, resolver, treasuryAta };
}

class Assertion {
  constructor(
    public id: PublicKey,
    public pdas: ReturnType<typeof derivePDAs>
  ) {}
}

class TestContext {
  constructor(
    public program: Program<Opal>,
    public provider: AnchorProvider,
    public connection: Connection,
    public token: TokenEnv,
    public proto: ProtocolEnv
  ) {}

  newAssertion(): Assertion {
    const id = Keypair.generate().publicKey;
    return new Assertion(id, derivePDAs(id, this.program.programId));
  }

  async createAssertion(
    a: Assertion,
    statement: string,
    bond: number,
    auxiliaryHash = RESOLUTION_SPEC_REFERENCE
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
      .rpc({ commitment: 'confirmed' });
  }

  async disputeAssertion(a: Assertion) {
    return this.program.methods
      .disputeAssertion({ assertionId: a.id })
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
      .rpc({ commitment: 'confirmed' });
  }

  async submitLlmResolution(a: Assertion, outcomeCode: number, resolver = this.proto.resolver) {
    return this.program.methods
      .submitLlmResolution({ assertionId: a.id, outcomeCode })
      .accounts({
        resolver: resolver.publicKey,
        protocolConfig: this.proto.configPda,
        assertion: a.pdas.assertion,
        llmResolutionRound: a.pdas.llmRound,
      })
      .signers([resolver])
      .rpc({ commitment: 'confirmed' });
  }

  async recoverPendingLlm(a: Assertion) {
    return this.program.methods
      .recoverPendingLlm({ assertionId: a.id })
      .accounts({
        finalizer: this.provider.wallet.publicKey,
        protocolConfig: this.proto.configPda,
        assertion: a.pdas.assertion,
        llmResolutionRound: a.pdas.llmRound,
      })
      .rpc({ commitment: 'confirmed' });
  }

  async finalizeLlmResolution(
    a: Assertion,
    accountOverrides: Partial<{
      asserterPusd: PublicKey;
      llmDisputerPusd: PublicKey;
      treasuryPusd: PublicKey;
    }> = {}
  ) {
    return this.program.methods
      .finalizeLlmResolution({ assertionId: a.id })
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
        ...accountOverrides,
      })
      .rpc({ commitment: 'confirmed' });
  }

  async challengeLlmResolution(a: Assertion) {
    return this.program.methods
      .challengeLlmResolution({ assertionId: a.id })
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
      .rpc({ commitment: 'confirmed' });
  }

  async openVote(a: Assertion) {
    return this.program.methods
      .openVote({ assertionId: a.id })
      .accounts({
        authority: this.proto.authority.publicKey,
        protocolConfig: this.proto.configPda,
        assertion: a.pdas.assertion,
        voteResolutionRound: a.pdas.voteRound,
      })
      .signers([this.proto.authority])
      .rpc({ commitment: 'confirmed' });
  }

  async finalizeVoteResolutionPlaceholder(a: Assertion, outcomeCode: number) {
    return this.program.methods
      .finalizeVoteResolutionPlaceholder({ assertionId: a.id, outcomeCode })
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
      .rpc({ commitment: 'confirmed' });
  }

  async finalizeUndisputed(a: Assertion) {
    return this.program.methods
      .finalizeUndisputed({ assertionId: a.id })
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
      .rpc({ commitment: 'confirmed' });
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

describe('opal', () => {
  let provider: AnchorProvider;
  let connection: Connection;
  let program: Program<Opal>;
  let token: TokenEnv;
  let proto: ProtocolEnv;
  let ctx: TestContext;

  beforeAll(async () => {
    provider = AnchorProvider.env();
    anchor.setProvider(provider);
    connection = provider.connection;
    program = anchor.workspace.Opal as Program<Opal>;
    token = await buildTokenEnv(connection);
  });

  async function attemptProtocolInitialization(
    authority: Keypair,
    resolver: PublicKey,
    assertionBondMinPusd: number,
    programData = programDataAddress(program.programId)
  ) {
    const [configPda] = PublicKey.findProgramAddressSync(
      [SEEDS.PROTOCOL_CONFIG],
      program.programId
    );
    const treasuryAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        token.mintAuthority,
        token.mint,
        token.treasury.publicKey
      )
    ).address;

    return program.methods
      .initializeProtocolConfig({
        resolver,
        assertionBondMinPusd: new BN(assertionBondMinPusd),
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
        llmResolutionTimeoutSeconds: new BN(300),
      })
      .accounts({
        authority: authority.publicKey,
        protocolConfig: configPda,
        pusdMint: token.mint,
        treasuryPusd: treasuryAta,
        program: program.programId,
        programData,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc({ commitment: 'confirmed' });
  }

  it('rejects initialization by a non-upgrade authority', async () => {
    const authority = Keypair.generate();
    const resolver = Keypair.generate();
    await fund(connection, authority.publicKey, 10_000_000_000);

    const [configPda] = PublicKey.findProgramAddressSync(
      [SEEDS.PROTOCOL_CONFIG],
      program.programId
    );
    const treasuryAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        token.mintAuthority,
        token.mint,
        token.treasury.publicKey
      )
    ).address;

    await expect(
      program.methods
        .initializeProtocolConfig({
          resolver: resolver.publicKey,
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
          llmResolutionTimeoutSeconds: new BN(300),
        })
        .accounts({
          authority: authority.publicKey,
          protocolConfig: configPda,
          pusdMint: token.mint,
          treasuryPusd: treasuryAta,
          program: program.programId,
          programData: programDataAddress(program.programId),
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc({ commitment: 'confirmed' })
    ).rejects.toThrow();
  });

  it('rejects protocol config with default resolver', async () => {
    const authority = provider.wallet.payer;

    const [configPda] = PublicKey.findProgramAddressSync(
      [SEEDS.PROTOCOL_CONFIG],
      program.programId
    );
    const treasuryAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        token.mintAuthority,
        token.mint,
        token.treasury.publicKey
      )
    ).address;

    await expect(
      program.methods
        .initializeProtocolConfig({
          resolver: PublicKey.default,
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
          llmResolutionTimeoutSeconds: new BN(300),
        })
        .accounts({
          authority: authority.publicKey,
          protocolConfig: configPda,
          pusdMint: token.mint,
          treasuryPusd: treasuryAta,
          program: program.programId,
          programData: programDataAddress(program.programId),
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc({ commitment: 'confirmed' })
    ).rejects.toThrow();
  });

  it('rejects initialization with an unrelated ProgramData account', async () => {
    await expect(
      attemptProtocolInitialization(
        provider.wallet.payer,
        Keypair.generate().publicKey,
        100,
        program.programId
      )
    ).rejects.toThrow();
  });

  it('rejects invalid protocol economics from the upgrade authority', async () => {
    await expect(
      attemptProtocolInitialization(provider.wallet.payer, Keypair.generate().publicKey, 0)
    ).rejects.toThrow();
  });

  it('rejects using the governance authority as the hot resolver', async () => {
    await expect(
      attemptProtocolInitialization(provider.wallet.payer, provider.wallet.publicKey, 100)
    ).rejects.toThrow();
  });

  it('initializes protocol', async () => {
    proto = await setupProtocol(program, token, provider.wallet.payer);
    ctx = new TestContext(program, provider, connection, token, proto);
  });

  it('rotates the resolver only through governance', async () => {
    const previousResolver = proto.resolver;
    const nextResolver = Keypair.generate();
    const unauthorized = Keypair.generate();

    await expect(
      program.methods
        .updateResolver({ newResolver: nextResolver.publicKey })
        .accounts({
          authority: unauthorized.publicKey,
          protocolConfig: proto.configPda,
        })
        .signers([unauthorized])
        .rpc({ commitment: 'confirmed' })
    ).rejects.toThrow();

    for (const invalidResolver of [
      PublicKey.default,
      proto.authority.publicKey,
      proto.resolver.publicKey,
    ]) {
      await expect(
        program.methods
          .updateResolver({ newResolver: invalidResolver })
          .accounts({
            authority: proto.authority.publicKey,
            protocolConfig: proto.configPda,
          })
          .signers([proto.authority])
          .rpc({ commitment: 'confirmed' })
      ).rejects.toThrow();
    }

    await program.methods
      .updateResolver({ newResolver: nextResolver.publicKey })
      .accounts({
        authority: proto.authority.publicKey,
        protocolConfig: proto.configPda,
      })
      .signers([proto.authority])
      .rpc({ commitment: 'confirmed' });

    const config = await program.account.protocolConfig.fetch(proto.configPda);
    expect(config.resolver.equals(nextResolver.publicKey)).toBe(true);
    proto.resolver = nextResolver;

    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Rotated resolver authorization', 200);
    await ctx.disputeAssertion(a);
    await expect(ctx.submitLlmResolution(a, OUTCOME.TRUE, previousResolver)).rejects.toThrow();
    await ctx.submitLlmResolution(a, OUTCOME.TRUE, nextResolver);
  });

  it('undisputed path: creates, waits, finalizes with correct payouts', async () => {
    const a = ctx.newAssertion();
    const bond = 200;
    const asserterStart = await balanceOf(connection, token.asserterAta);
    const treasuryStart = await balanceOf(connection, proto.treasuryAta);

    await ctx.createAssertion(a, 'Bitcoin > $100k by 2026', bond);

    const acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.ASSERTED);
    expect(acc.disputeCount).toBe(0);
    expect(acc.outcome).toBe(OUTCOME.NONE);

    await sleep(4000);

    await ctx.finalizeUndisputed(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.TRUE);
    expect(resolved.finalizedAt.toNumber()).toBeGreaterThan(0);

    // fee = 200 * 250 / 10000 = 5
    expect(await balanceOf(connection, token.asserterAta)).toBe(asserterStart - bond + (bond - 5));
    expect(await balanceOf(connection, proto.treasuryAta)).toBe(treasuryStart + 5);
  });

  it('llm resolution path: disputes, resolves via llm, pays winner', async () => {
    const a = ctx.newAssertion();
    const bond = 200;

    const asserterStart = await balanceOf(connection, token.asserterAta);
    await ctx.createAssertion(a, 'ETH flips BTC', bond);

    const disputerStart = await balanceOf(connection, token.llmDisputerAta);
    const treasuryStart = await balanceOf(connection, proto.treasuryAta);

    await ctx.disputeAssertion(a);

    let acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.PENDING_LLM);
    expect(acc.disputeCount).toBe(1);

    await ctx.submitLlmResolution(a, 1);

    acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.ASSERTED_LLM);

    const round = await ctx.fetchLlmRound(a);
    expect(round.outcome).toBe(OUTCOME.FALSE);
    expect(round.challengeDeadline.toNumber()).toBeGreaterThan(0);

    await sleep(4000);

    await ctx.finalizeLlmResolution(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.FALSE);

    const dispute = await ctx.fetchLlmDispute(a);
    expect(dispute.settlementResolution).toBe(OUTCOME.FALSE);

    // disputer was correct (outcome != TRUE). Net gain = assertion bond - fee = 195.
    expect(await balanceOf(connection, token.llmDisputerAta)).toBe(disputerStart + 195);
    const settledTotal =
      (await balanceOf(connection, token.asserterAta)) +
      (await balanceOf(connection, token.llmDisputerAta)) +
      (await balanceOf(connection, proto.treasuryAta));
    expect(settledTotal).toBe(asserterStart + disputerStart + treasuryStart);
    expect(await balanceOf(connection, a.pdas.bondVault)).toBe(0);
  });

  it('conserves all tokens when the LLM resolves True', async () => {
    const a = ctx.newAssertion();
    const startTotal =
      (await balanceOf(connection, token.asserterAta)) +
      (await balanceOf(connection, token.llmDisputerAta)) +
      (await balanceOf(connection, proto.treasuryAta));

    await ctx.createAssertion(a, 'LLM true conservation', 200);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.TRUE);
    await sleep(4000);
    await ctx.finalizeLlmResolution(a);

    const settledTotal =
      (await balanceOf(connection, token.asserterAta)) +
      (await balanceOf(connection, token.llmDisputerAta)) +
      (await balanceOf(connection, proto.treasuryAta));
    expect(settledTotal).toBe(startTotal);
    expect(await balanceOf(connection, a.pdas.bondVault)).toBe(0);
  });

  it('full escalation path: escalates to vote and resolves', async () => {
    const a = ctx.newAssertion();
    const startTotal =
      (await balanceOf(connection, token.asserterAta)) +
      (await balanceOf(connection, token.llmDisputerAta)) +
      (await balanceOf(connection, token.voteDisputerAta)) +
      (await balanceOf(connection, proto.treasuryAta));

    await ctx.createAssertion(a, 'Solana TPS > 10000', 500);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, 0);
    await ctx.challengeLlmResolution(a);
    await ctx.openVote(a);

    let acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.VOTING);

    await sleep(5000);

    // sanity-check accounts exist before calling finalize
    await ctx.fetchVoteDispute(a);
    await ctx.fetchVoteRound(a);

    await ctx.finalizeVoteResolutionPlaceholder(a, 1);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.FALSE);
    expect(resolved.finalizedAt.toNumber()).toBeGreaterThan(0);

    const llmDisp = await ctx.fetchLlmDispute(a);
    expect(llmDisp.settlementResolution).not.toBe(OUTCOME.NONE);

    const voteDisp = await ctx.fetchVoteDispute(a);
    expect(voteDisp.settlementResolution).not.toBe(OUTCOME.NONE);

    const vr = await ctx.fetchVoteRound(a);
    expect(vr.finalOutcome).toBe(OUTCOME.FALSE);

    const settledTotal =
      (await balanceOf(connection, token.asserterAta)) +
      (await balanceOf(connection, token.llmDisputerAta)) +
      (await balanceOf(connection, token.voteDisputerAta)) +
      (await balanceOf(connection, proto.treasuryAta));
    expect(settledTotal).toBe(startTotal);
    expect(await balanceOf(connection, a.pdas.bondVault)).toBe(0);
  });

  it('conserves all tokens when the vote resolves True', async () => {
    const a = ctx.newAssertion();
    const startTotal =
      (await balanceOf(connection, token.asserterAta)) +
      (await balanceOf(connection, token.llmDisputerAta)) +
      (await balanceOf(connection, token.voteDisputerAta)) +
      (await balanceOf(connection, proto.treasuryAta));

    await ctx.createAssertion(a, 'Vote true conservation', 500);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.FALSE);
    await ctx.challengeLlmResolution(a);
    await ctx.openVote(a);
    await sleep(5000);
    await ctx.finalizeVoteResolutionPlaceholder(a, OUTCOME.TRUE);

    const settledTotal =
      (await balanceOf(connection, token.asserterAta)) +
      (await balanceOf(connection, token.llmDisputerAta)) +
      (await balanceOf(connection, token.voteDisputerAta)) +
      (await balanceOf(connection, proto.treasuryAta));
    expect(settledTotal).toBe(startTotal);
    expect(await balanceOf(connection, a.pdas.bondVault)).toBe(0);
  });

  it('error: premature finalizeUndisputed', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Test', 200);

    await expect(ctx.finalizeUndisputed(a)).rejects.toThrow();
  });

  it('error: insufficient bond', async () => {
    const a = ctx.newAssertion();
    await expect(ctx.createAssertion(a, 'Fail', 50)).rejects.toThrow();
  });

  it('error: malformed Resolution Spec reference', async () => {
    const a = ctx.newAssertion();
    await expect(
      ctx.createAssertion(a, 'Missing verifiable spec', 200, 'devnet-rehearsal-no-spec')
    ).rejects.toThrow();
  });

  it('error: disputing after liveness deadline', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Late dispute', 200);
    await sleep(4000);

    await expect(ctx.disputeAssertion(a)).rejects.toThrow();
  });

  it('error: submitLlmResolution when state is Asserted', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'No dispute', 200);

    await expect(ctx.submitLlmResolution(a, 0)).rejects.toThrow();
  });

  it('error: submitLlmResolution from a non-resolver signer', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Wrong signer', 200);
    await ctx.disputeAssertion(a);

    await expect(ctx.submitLlmResolution(a, 0, proto.authority)).rejects.toThrow();
  });

  it('error: submitLlmResolution with TooEarly outcome', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Too early', 200);
    await ctx.disputeAssertion(a);

    await expect(ctx.submitLlmResolution(a, OUTCOME.TOO_EARLY)).rejects.toThrow();
  });

  it('error: submitLlmResolution twice on the same round', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Double submit', 200);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.TRUE);

    await expect(ctx.submitLlmResolution(a, OUTCOME.FALSE)).rejects.toThrow();
  });

  it('recovers a timed-out PendingLLM round as challengeable Unresolvable', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Resolver outage recovery', 200);
    await ctx.disputeAssertion(a);

    await expect(ctx.recoverPendingLlm(a)).rejects.toThrow();
    await sleep(3000);
    await ctx.recoverPendingLlm(a);

    const round = await ctx.fetchLlmRound(a);
    expect(round.outcome).toBe(OUTCOME.UNRESOLVABLE);
    expect(round.resolvedAt.toNumber()).toBeGreaterThan(0);
    expect(round.challengeDeadline.toNumber()).toBeGreaterThan(0);

    const assertion = await ctx.fetchAssertion(a);
    expect(assertion.state).toBe(STATE.ASSERTED_LLM);
    expect(assertion.llmChallengeDeadline.toNumber()).toBe(round.challengeDeadline.toNumber());

    await expect(ctx.recoverPendingLlm(a)).rejects.toThrow();
    await expect(ctx.submitLlmResolution(a, OUTCOME.TRUE)).rejects.toThrow();
  });

  it('settles an Unresolvable LLM verdict no-fault', async () => {
    const a = ctx.newAssertion();
    const asserterStart = await balanceOf(connection, token.asserterAta);
    const llmDisputerStart = await balanceOf(connection, token.llmDisputerAta);
    const treasuryStart = await balanceOf(connection, proto.treasuryAta);

    await ctx.createAssertion(a, 'Undecidable claim', 200);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.UNRESOLVABLE);

    const round = await ctx.fetchLlmRound(a);
    expect(round.outcome).toBe(OUTCOME.UNRESOLVABLE);

    const acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.ASSERTED_LLM);

    await sleep(4000);
    await ctx.finalizeLlmResolution(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.UNRESOLVABLE);

    const dispute = await ctx.fetchLlmDispute(a);
    expect(dispute.settlementResolution).toBe(OUTCOME.UNRESOLVABLE);

    expect(await balanceOf(connection, token.asserterAta)).toBe(asserterStart);
    expect(await balanceOf(connection, token.llmDisputerAta)).toBe(llmDisputerStart);
    expect(await balanceOf(connection, proto.treasuryAta)).toBe(treasuryStart);
    expect(await balanceOf(connection, a.pdas.bondVault)).toBe(0);
  });

  it('settles an Unresolvable vote no-fault', async () => {
    const a = ctx.newAssertion();
    const asserterStart = await balanceOf(connection, token.asserterAta);
    const llmDisputerStart = await balanceOf(connection, token.llmDisputerAta);
    const voteDisputerStart = await balanceOf(connection, token.voteDisputerAta);
    const treasuryStart = await balanceOf(connection, proto.treasuryAta);

    await ctx.createAssertion(a, 'No vote outcome reaches supermajority', 500);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.TRUE);
    await ctx.challengeLlmResolution(a);
    await ctx.openVote(a);
    await sleep(5000);

    await ctx.finalizeVoteResolutionPlaceholder(a, OUTCOME.UNRESOLVABLE);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.UNRESOLVABLE);

    const llmDispute = await ctx.fetchLlmDispute(a);
    expect(llmDispute.settlementResolution).toBe(OUTCOME.UNRESOLVABLE);

    const voteDispute = await ctx.fetchVoteDispute(a);
    expect(voteDispute.settlementResolution).toBe(OUTCOME.UNRESOLVABLE);

    const voteRound = await ctx.fetchVoteRound(a);
    expect(voteRound.finalOutcome).toBe(OUTCOME.UNRESOLVABLE);

    expect(await balanceOf(connection, token.asserterAta)).toBe(asserterStart);
    expect(await balanceOf(connection, token.llmDisputerAta)).toBe(llmDisputerStart);
    expect(await balanceOf(connection, token.voteDisputerAta)).toBe(voteDisputerStart);
    expect(await balanceOf(connection, proto.treasuryAta)).toBe(treasuryStart);
    expect(await balanceOf(connection, a.pdas.bondVault)).toBe(0);
  });

  it('rejects TooEarly from the vote placeholder', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Deprecated vote outcome', 200);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.TRUE);
    await ctx.challengeLlmResolution(a);
    await ctx.openVote(a);
    await sleep(5000);

    await expect(ctx.finalizeVoteResolutionPlaceholder(a, OUTCOME.TOO_EARLY)).rejects.toThrow();
  });

  it('error: challengeLlmResolution after challenge deadline', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Missed challenge', 200);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, 0);
    await sleep(4000);

    await expect(ctx.challengeLlmResolution(a)).rejects.toThrow();
  });

  it('error: disputing an already-disputed assertion', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Double dispute', 200);
    await ctx.disputeAssertion(a);

    await expect(ctx.disputeAssertion(a)).rejects.toThrow();
  });

  it('error: mismatched llmDispute account', async () => {
    const a1 = ctx.newAssertion();
    const a2 = ctx.newAssertion();

    // create and dispute assertion1
    await ctx.createAssertion(a1, 'A1', 200);
    await ctx.disputeAssertion(a1);

    // create assertion2 (undisputed) so we can try to pass its dispute for assertion1
    await ctx.createAssertion(a2, 'A2', 200);

    // finalizeLlmResolution with assertion1 but llmDispute from assertion2
    // should fail because the dispute doesn't link back to assertion1
    await expect(
      program.methods
        .finalizeLlmResolution({ assertionId: a1.id })
        .accounts({
          finalizer: provider.wallet.publicKey,
          protocolConfig: proto.configPda,
          pusdMint: token.mint,
          assertion: a1.pdas.assertion,
          llmDispute: a2.pdas.llmDispute,
          llmResolutionRound: a1.pdas.llmRound,
          bondVault: a1.pdas.bondVault,
          asserterPusd: token.asserterAta,
          llmDisputerPusd: token.llmDisputerAta,
          treasuryPusd: proto.treasuryAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: 'confirmed' })
    ).rejects.toThrow();
  });

  it('rejects substituted payout token accounts without moving funds', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Payout account substitution', 200);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.FALSE);
    await sleep(4000);

    const before = {
      asserter: await balanceOf(connection, token.asserterAta),
      llmDisputer: await balanceOf(connection, token.llmDisputerAta),
      treasury: await balanceOf(connection, proto.treasuryAta),
      vault: await balanceOf(connection, a.pdas.bondVault),
    };

    await expect(
      ctx.finalizeLlmResolution(a, { asserterPusd: token.voteDisputerAta })
    ).rejects.toThrow();
    await expect(
      ctx.finalizeLlmResolution(a, { llmDisputerPusd: token.voteDisputerAta })
    ).rejects.toThrow();
    await expect(
      ctx.finalizeLlmResolution(a, { treasuryPusd: token.voteDisputerAta })
    ).rejects.toThrow();

    expect(await balanceOf(connection, token.asserterAta)).toBe(before.asserter);
    expect(await balanceOf(connection, token.llmDisputerAta)).toBe(before.llmDisputer);
    expect(await balanceOf(connection, proto.treasuryAta)).toBe(before.treasury);
    expect(await balanceOf(connection, a.pdas.bondVault)).toBe(before.vault);

    await ctx.finalizeLlmResolution(a);
    expect((await ctx.fetchAssertion(a)).state).toBe(STATE.RESOLVED);
    expect(await balanceOf(connection, a.pdas.bondVault)).toBe(0);
  });
});
