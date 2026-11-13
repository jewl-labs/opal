import { describe, it, expect, beforeAll } from 'bun:test';
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
} from '@solana/web3.js';
import * as anchor from '@anchor-lang/core';
import { Program, AnchorProvider, BN } from '@anchor-lang/core';
import type { IdlTypes } from '@anchor-lang/core';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
} from '@solana/spl-token';

import idl from '../target/idl/opal.json';
import type { Opal } from '../target/types/opal';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Seeds, states and outcomes are `#[constant]`s in constants.rs, read back from the IDL.
function idlConstant(name: string): string {
  const found = idl.constants.find((c) => c.name === name);
  if (!found) throw new Error(`constant ${name} is missing from the IDL`);
  return found.value;
}
const seed = (name: string) => Buffer.from(JSON.parse(idlConstant(name)) as number[]);
const code = (name: string) => Number(idlConstant(name));

const SEEDS = {
  PROTOCOL_CONFIG: seed('PROTOCOL_CONFIG_SEED'),
  ASSERTION: seed('ASSERTION_SEED'),
  BOND_VAULT: seed('BOND_VAULT_SEED'),
  LLM_DISPUTE: seed('LLM_DISPUTE_SEED'),
  VOTE_DISPUTE: seed('VOTE_DISPUTE_SEED'),
  LLM_ROUND: seed('LLM_ROUND_SEED'),
};

const STATE = {
  ASSERTED: code('ASSERTION_STATE_ASSERTED'),
  PENDING_LLM: code('ASSERTION_STATE_PENDING_LLM'),
  ASSERTED_LLM: code('ASSERTION_STATE_ASSERTED_LLM'),
  PENDING_VOTE: code('ASSERTION_STATE_PENDING_VOTE'),
  RESOLVED: code('ASSERTION_STATE_RESOLVED'),
};

const OUTCOME = {
  TRUE: code('OUTCOME_TRUE'),
  FALSE: code('OUTCOME_FALSE'),
  TOO_EARLY: code('OUTCOME_TOO_EARLY'),
  UNRESOLVABLE: code('OUTCOME_UNRESOLVABLE'),
  NONE: code('OUTCOME_NONE'),
};

// Windows are long on purpose: tests cross them with `advanceSeconds`, never by waiting.
const LIVENESS_SECONDS = 3600;
const CHALLENGE_SECONDS = 1800;

type ConfigArgs = IdlTypes<Opal>['initializeProtocolConfigArgs'];

const CONFIG_DEFAULTS: Omit<ConfigArgs, 'resolver'> = {
  assertionBondMinUsdc: new BN(100),
  llmDisputeBondRatioBps: 5000,
  voteDisputeBondRatioBps: 3000,
  protocolFeeBps: 250,
  livenessWindowSeconds: new BN(LIVENESS_SECONDS),
  llmChallengeWindowSeconds: new BN(CHALLENGE_SECONDS),
};

async function fund(connection: Connection, pk: PublicKey, lamports: number) {
  const sig = await connection.requestAirdrop(pk, lamports);
  await connection.confirmTransaction(sig, 'confirmed');
}

async function balanceOf(connection: Connection, ata: PublicKey) {
  const acc = await getAccount(connection, ata, 'confirmed');
  return Number(acc.amount);
}

// The on-chain Clock is in seconds; the sysvar stores `unix_timestamp` at byte offset 32.
async function chainTime(connection: Connection): Promise<number> {
  const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, 'confirmed');
  if (!info) throw new Error('clock sysvar not found');
  return Number(info.data.readBigInt64LE(32));
}

// Warps the surfpool clock forward so the on-chain time is at least `seconds` later.
// `surfnet_timeTravel` takes MILLISECONDS and only moves forward; it rejects a target
// the clock has already passed, so re-read and retry if the clock raced ahead of us.
async function advanceSeconds(connection: Connection, seconds: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const before = await chainTime(connection);
    const res = await fetch(connection.rpcEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'surfnet_timeTravel',
        params: [{ absoluteTimestamp: (before + seconds) * 1000 }],
      }),
    });
    const body = (await res.json()) as { error?: { data?: string; message: string } };
    if (body.error) {
      if (String(body.error.data).includes('past timestamp')) continue;
      throw new Error(`surfnet_timeTravel failed: ${JSON.stringify(body.error)}`);
    }
    const after = await chainTime(connection);
    if (after < before + seconds) {
      throw new Error(`clock only reached ${after}, wanted ${before + seconds}`);
    }
    return;
  }
  throw new Error('surfnet_timeTravel kept targeting the past');
}

// Asserts the call is rejected with the named program error: an Opal error such as
// `DeadlineNotReached`, or an Anchor error such as `ConstraintSeeds`.
async function expectProgramError(call: Promise<unknown>, name: string) {
  let failure: unknown;
  try {
    await call;
  } catch (e) {
    failure = e;
  }
  if (failure === undefined) throw new Error(`expected ${name}, but the call succeeded`);

  if (failure instanceof anchor.AnchorError) {
    expect(failure.error.errorCode.code).toBe(name);
    return;
  }
  // Not an Anchor error (e.g. a System Program failure): match the name in the logs.
  const logs = (failure as { logs?: string[] }).logs ?? [];
  expect([String(failure), ...logs].join('\n')).toContain(name);
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
  return { assertion, bondVault, llmDispute, llmRound, voteDispute };
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

// `args` override CONFIG_DEFAULTS; the resolver is always explicit.
async function initializeConfig(
  program: Program<Opal>,
  token: TokenEnv,
  authority: Keypair,
  args: Pick<ConfigArgs, 'resolver'> & Partial<ConfigArgs>
) {
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
    .initializeProtocolConfig({ ...CONFIG_DEFAULTS, ...args })
    .accounts({
      authority: authority.publicKey,
      protocolConfig: configPda,
      usdcMint: token.mint,
      treasuryUsdc: treasuryAta,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc({ commitment: 'confirmed' });

  return { configPda, treasuryAta };
}

class Assertion {
  constructor(
    public id: PublicKey,
    public pdas: ReturnType<typeof derivePDAs>
  ) {}
}

type Balances = { asserter: number; llmDisputer: number; treasury: number; vault: number };

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

  async balances(a: Assertion): Promise<Balances> {
    return {
      asserter: await balanceOf(this.connection, this.token.asserterAta),
      llmDisputer: await balanceOf(this.connection, this.token.llmDisputerAta),
      treasury: await balanceOf(this.connection, this.proto.treasuryAta),
      vault: await balanceOf(this.connection, a.pdas.bondVault),
    };
  }

  async createAssertion(a: Assertion, statement: string, bond: number, auxiliaryHash = 'hash') {
    return this.program.methods
      .createAssertion({
        assertionId: a.id,
        statement,
        auxiliaryHash,
        assertionBondAmountUsdc: new BN(bond),
      })
      .accounts({
        asserter: this.token.asserter.publicKey,
        protocolConfig: this.proto.configPda,
        usdcMint: this.token.mint,
        assertion: a.pdas.assertion,
        bondVault: a.pdas.bondVault,
        asserterUsdc: this.token.asserterAta,
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
        usdcMint: this.token.mint,
        assertion: a.pdas.assertion,
        llmDispute: a.pdas.llmDispute,
        llmResolutionRound: a.pdas.llmRound,
        bondVault: a.pdas.bondVault,
        disputerUsdc: this.token.llmDisputerAta,
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

  async finalizeLlmResolution(a: Assertion, llmDispute = a.pdas.llmDispute) {
    return this.program.methods
      .finalizeLlmResolution({ assertionId: a.id })
      .accounts({
        finalizer: this.provider.wallet.publicKey,
        protocolConfig: this.proto.configPda,
        usdcMint: this.token.mint,
        assertion: a.pdas.assertion,
        llmDispute,
        llmResolutionRound: a.pdas.llmRound,
        bondVault: a.pdas.bondVault,
        asserterUsdc: this.token.asserterAta,
        llmDisputerUsdc: this.token.llmDisputerAta,
        treasuryUsdc: this.proto.treasuryAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' });
  }

  async challengeLlmResolution(a: Assertion) {
    return this.program.methods
      .challengeLlmResolution({ assertionId: a.id })
      .accounts({
        disputer: this.token.voteDisputer.publicKey,
        protocolConfig: this.proto.configPda,
        usdcMint: this.token.mint,
        assertion: a.pdas.assertion,
        llmResolutionRound: a.pdas.llmRound,
        voteDispute: a.pdas.voteDispute,
        bondVault: a.pdas.bondVault,
        disputerUsdc: this.token.voteDisputerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.token.voteDisputer])
      .rpc({ commitment: 'confirmed' });
  }

  async finalizeUndisputed(a: Assertion) {
    return this.program.methods
      .finalizeUndisputed({ assertionId: a.id })
      .accounts({
        finalizer: this.provider.wallet.publicKey,
        protocolConfig: this.proto.configPda,
        usdcMint: this.token.mint,
        assertion: a.pdas.assertion,
        bondVault: a.pdas.bondVault,
        asserterUsdc: this.token.asserterAta,
        treasuryUsdc: this.proto.treasuryAta,
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

  // Creates, disputes, resolves via the LLM and finalizes after the challenge window.
  // Returns the balances just before and just after the final settlement.
  async settleViaLlm(a: Assertion, bond: number, outcome: number) {
    await this.createAssertion(a, `LLM settlement, outcome ${outcome}`, bond);
    await this.disputeAssertion(a);
    await this.submitLlmResolution(a, outcome);
    await advanceSeconds(this.connection, CHALLENGE_SECONDS + 1);

    const before = await this.balances(a);
    await this.finalizeLlmResolution(a);
    const after = await this.balances(a);
    return { before, after };
  }
}

// Every unit in the vault before settlement leaves it: recipients and treasury gain the bonds.
function expectConserved(before: Balances, after: Balances, bonds: number) {
  expect(before.vault).toBe(bonds);
  expect(after.vault).toBe(0);
  const gained =
    after.asserter -
    before.asserter +
    (after.llmDisputer - before.llmDisputer) +
    (after.treasury - before.treasury);
  expect(gained).toBe(bonds);
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

  // The config rejection tests run before the config exists, so the only way they can
  // reject is by failing validation (not because the PDA is already initialized).
  it('rejects a zero assertion bond minimum', async () => {
    const authority = Keypair.generate();
    await fund(connection, authority.publicKey, 10_000_000_000);

    await expectProgramError(
      initializeConfig(program, token, authority, {
        resolver: authority.publicKey,
        assertionBondMinUsdc: new BN(0),
      }),
      'InvalidAssertionBondMinimum'
    );
  });

  it('rejects protocol config with default resolver', async () => {
    const authority = Keypair.generate();
    await fund(connection, authority.publicKey, 10_000_000_000);

    await expectProgramError(
      initializeConfig(program, token, authority, { resolver: PublicKey.default }),
      'ConfigInvariantViolation'
    );
  });

  it('rejects protocol config with a non-positive window', async () => {
    const authority = Keypair.generate();
    await fund(connection, authority.publicKey, 10_000_000_000);

    await expectProgramError(
      initializeConfig(program, token, authority, {
        resolver: authority.publicKey,
        llmChallengeWindowSeconds: new BN(0),
      }),
      'InvalidWindowConfiguration'
    );
  });

  it('initializes protocol', async () => {
    const authority = provider.wallet.payer;
    const resolver = Keypair.generate();
    const { configPda, treasuryAta } = await initializeConfig(program, token, authority, {
      resolver: resolver.publicKey,
    });
    proto = { configPda, authority, resolver, treasuryAta };
    ctx = new TestContext(program, provider, connection, token, proto);

    const config = await program.account.protocolConfig.fetch(configPda);
    expect(config.resolver.toBase58()).toBe(resolver.publicKey.toBase58());
    expect(config.protocolFeeBps).toBe(250);
    expect(config.livenessWindowSeconds.toNumber()).toBe(LIVENESS_SECONDS);
    expect(config.llmChallengeWindowSeconds.toNumber()).toBe(CHALLENGE_SECONDS);
  });

  it('undisputed path: creates, waits, finalizes with correct payouts', async () => {
    const a = ctx.newAssertion();
    const bond = 200;

    await ctx.createAssertion(a, 'Bitcoin > $100k by 2026', bond, 'hash123');

    const acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.ASSERTED);
    expect(acc.disputeCount).toBe(0);
    expect(acc.outcome).toBe(OUTCOME.NONE);

    await advanceSeconds(connection, LIVENESS_SECONDS + 1);

    const before = await ctx.balances(a);
    await ctx.finalizeUndisputed(a);
    const after = await ctx.balances(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.TRUE);
    expect(resolved.finalizedAt.toNumber()).toBeGreaterThan(0);

    // fee = 200 * 250 / 10000 = 5
    expect(after.asserter - before.asserter).toBe(bond - 5);
    expect(after.treasury - before.treasury).toBe(5);
    expectConserved(before, after, bond);
  });

  it('llm resolution path: disputes, resolves via llm, pays winner', async () => {
    const a = ctx.newAssertion();
    const bond = 200;

    await ctx.createAssertion(a, 'ETH flips BTC', bond, 'abc');
    await ctx.disputeAssertion(a);

    let acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.PENDING_LLM);
    expect(acc.disputeCount).toBe(1);

    await ctx.submitLlmResolution(a, OUTCOME.FALSE);

    acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.ASSERTED_LLM);

    const round = await ctx.fetchLlmRound(a);
    expect(round.outcome).toBe(OUTCOME.FALSE);
    expect(round.challengeDeadline.toNumber()).toBeGreaterThan(0);

    await advanceSeconds(connection, CHALLENGE_SECONDS + 1);

    const before = await ctx.balances(a);
    await ctx.finalizeLlmResolution(a);
    const after = await ctx.balances(a);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.FALSE);

    const dispute = await ctx.fetchLlmDispute(a);
    expect(dispute.settlementResolution).toBe(OUTCOME.FALSE);

    // dispute bond = 50% of 200 = 100; fee = 200 * 250 / 10000 = 5.
    // The disputer was right: they get their 100 back plus the asserter's 200 minus the fee.
    expect(after.llmDisputer - before.llmDisputer).toBe(100 + 195);
    expect(after.asserter - before.asserter).toBe(0);
    expect(after.treasury - before.treasury).toBe(5);
    expectConserved(before, after, bond + 100);
  });

  it('llm resolution path: a True verdict pays the asserter', async () => {
    const a = ctx.newAssertion();
    const { before, after } = await ctx.settleViaLlm(a, 200, OUTCOME.TRUE);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.TRUE);

    // fee = 100 * 250 / 10000 = 2 (floored); the asserter keeps 200 and wins 100 - 2.
    expect(after.asserter - before.asserter).toBe(200 + 98);
    expect(after.llmDisputer - before.llmDisputer).toBe(0);
    expect(after.treasury - before.treasury).toBe(2);
    expectConserved(before, after, 300);
  });

  it('llm resolution path: an Unresolvable verdict pays the disputer', async () => {
    const a = ctx.newAssertion();
    const { before, after } = await ctx.settleViaLlm(a, 200, OUTCOME.UNRESOLVABLE);

    const resolved = await ctx.fetchAssertion(a);
    expect(resolved.state).toBe(STATE.RESOLVED);
    expect(resolved.outcome).toBe(OUTCOME.UNRESOLVABLE);

    const dispute = await ctx.fetchLlmDispute(a);
    expect(dispute.settlementResolution).toBe(OUTCOME.UNRESOLVABLE);

    // Same payout as False: the disputer gets 100 + (200 - 5), the treasury 5.
    expect(after.llmDisputer - before.llmDisputer).toBe(295);
    expect(after.asserter - before.asserter).toBe(0);
    expect(after.treasury - before.treasury).toBe(5);
    expectConserved(before, after, 300);
  });

  it('full escalation path: challenge moves the assertion to PendingVote', async () => {
    const a = ctx.newAssertion();

    await ctx.createAssertion(a, 'Solana TPS > 10000', 500, 'perf');
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.TRUE);
    await ctx.challengeLlmResolution(a);

    const acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.PENDING_VOTE);
    expect(acc.disputeCount).toBe(2);
    expect(acc.voteDispute.toBase58()).toBe(a.pdas.voteDispute.toBase58());

    // assertion bond 500 + llm dispute 50% (250) + vote dispute 30% (150)
    expect(await balanceOf(connection, a.pdas.bondVault)).toBe(500 + 250 + 150);
  });

  it('error: premature finalizeUndisputed', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Test', 200);

    await expectProgramError(ctx.finalizeUndisputed(a), 'DeadlineNotReached');
  });

  it('error: insufficient bond', async () => {
    const a = ctx.newAssertion();
    await expectProgramError(ctx.createAssertion(a, 'Fail', 50), 'InsufficientBondAmount');
  });

  it('error: disputing after liveness deadline', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Late dispute', 200);
    await advanceSeconds(connection, LIVENESS_SECONDS + 1);

    await expectProgramError(ctx.disputeAssertion(a), 'DeadlinePassed');
  });

  it('error: submitLlmResolution before any dispute exists', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'No dispute', 200);

    // The llm round PDA only exists once the assertion is disputed; until then it is an
    // empty System Program account.
    await expectProgramError(
      ctx.submitLlmResolution(a, OUTCOME.TRUE),
      'AccountOwnedByWrongProgram'
    );
  });

  it('error: submitLlmResolution from a non-resolver signer', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Wrong signer', 200);
    await ctx.disputeAssertion(a);

    await expectProgramError(
      ctx.submitLlmResolution(a, OUTCOME.TRUE, proto.authority),
      'Unauthorized'
    );
  });

  it('error: submitLlmResolution with an outcome the resolver cannot post', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Too early', 200);
    await ctx.disputeAssertion(a);

    // 2 is reserved for the vote-only outcome; 4 and 255 are not outcomes at all.
    for (const outcome of [OUTCOME.TOO_EARLY, 4, OUTCOME.NONE]) {
      await expectProgramError(ctx.submitLlmResolution(a, outcome), 'InvalidOutcomeCode');
    }
  });

  it('error: submitLlmResolution twice on the same round', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Double submit', 200);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.TRUE);

    await expectProgramError(ctx.submitLlmResolution(a, OUTCOME.FALSE), 'InvalidState');
  });

  it('accepts an Unresolvable verdict from the resolver', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Undecidable claim', 200);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.UNRESOLVABLE);

    const round = await ctx.fetchLlmRound(a);
    expect(round.outcome).toBe(OUTCOME.UNRESOLVABLE);

    const acc = await ctx.fetchAssertion(a);
    expect(acc.state).toBe(STATE.ASSERTED_LLM);
  });

  it('error: finalizeLlmResolution before the challenge deadline', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Too soon', 200);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.TRUE);

    await expectProgramError(ctx.finalizeLlmResolution(a), 'DeadlineNotReached');
  });

  it('error: challengeLlmResolution after challenge deadline', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Missed challenge', 200);
    await ctx.disputeAssertion(a);
    await ctx.submitLlmResolution(a, OUTCOME.TRUE);
    await advanceSeconds(connection, CHALLENGE_SECONDS + 1);

    await expectProgramError(ctx.challengeLlmResolution(a), 'DeadlinePassed');
  });

  it('error: disputing an already-disputed assertion', async () => {
    const a = ctx.newAssertion();
    await ctx.createAssertion(a, 'Double dispute', 200);
    await ctx.disputeAssertion(a);

    // The dispute PDAs exist already, so `init` fails before the handler's state check runs.
    await expectProgramError(ctx.disputeAssertion(a), 'already in use');
  });

  it('error: mismatched llmDispute account', async () => {
    const a1 = ctx.newAssertion();
    const a2 = ctx.newAssertion();

    await ctx.createAssertion(a1, 'A1', 200, 'a1');
    await ctx.disputeAssertion(a1);
    await ctx.createAssertion(a2, 'A2', 200, 'a2');
    await ctx.disputeAssertion(a2);

    // finalizeLlmResolution for a1 with the llmDispute PDA that belongs to a2.
    await expectProgramError(ctx.finalizeLlmResolution(a1, a2.pdas.llmDispute), 'ConstraintSeeds');
  });
});
