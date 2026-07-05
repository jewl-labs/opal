# Opal

A Solana-native optimistic oracle for natural-language statements.

Opal treats assertions as true by default. If nobody disputes within a liveness window, the assertion resolves `True`. If disputed, it escalates through an LLM resolution round and (if challenged) a staked private vote.

Opal resolves **rubric-relative truth**, not absolute truth: every assertion ships its own Resolution Spec — the asserter's rubric for _how_ the statement should be judged — and Opal applies that spec rather than adjudicating any universal reality. The same statement text can resolve differently across assertions. See [ADR-0001](docs/adr/0001-rubric-relative-truth.md).

Target use case: prediction-market resolution. Statements like "Kanye West's Delhi concert got postponed" can't be answered by price feeds or APIs — they need a purpose-built oracle, and they need someone to declare _by what standard_ "postponed" is judged.

> **Status:** this README describes Opal's full **target design**. Feature status is tracked with badges — `[Built]` is implemented in the program today, `[MVP-target]` is committed but not yet built, `[Vision]` is post-MVP. Sections below are the design; see [Current State](#current-state) for exactly what's live.

## How It Works

1. **Assert** — someone posts a statement, a USDC bond, and a Resolution Spec (the rubric; stored off-chain on Arweave, its hash on-chain)
2. **Wait** — liveness window where anyone can dispute
3. **Undisputed** — if no dispute, resolves `True`
4. **Disputed** — the first dispute triggers on-chain LLM resolution: a single trusted off-chain resolver posts the verdict `[MVP-target]` (tests drive this step with the `mock-llm` stand-in; the former 3-feed Switchboard council was removed per [ADR-0002](docs/adr/0002-trusted-llm-resolver.md))
5. **Challenged** — if the LLM verdict is challenged, escalate to a per-dispute staked vote, kept private during the voting window via a MagicBlock ephemeral rollup ([ADR-0003](docs/adr/0003-private-staked-voting.md))
6. **Resolved** — the final outcome is posted on-chain

The LLM layer is deliberately trusted, not trustless: a wrong verdict is challengeable into the staked vote, which is the real trust backstop.

## Resolution Outcomes

- `True` — verified under the spec
- `False` — contradicted under the spec
- `Unresolvable` — cannot be decided under the spec (ambiguous, conflicting, premature, or no outcome reached the vote's supermajority). `[MVP-target]` Settles **no-fault**: both bonds are returned, no one is slashed, and the assertion is voided (today any non-`True` outcome is settled like `False`) ([ADR-0005](docs/adr/0005-no-fault-unresolvable.md)).

## Voting `[MVP-target]`

The final escalation is a private, per-dispute, USDC-staked vote (today `open_vote` sets up the round, but real staking, tallying, and MagicBlock privacy are not yet built):

- **Linear weight** — 1 staked USDC = 1 vote. Sybil-neutral; whale dominance is deterred by slashing, not by a weight curve.
- **Schelling-point slashing** — losing-side voters are slashed and winning-side voters are paid from the losing side, so the honest answer under the spec is the focal point.
- **Private** — votes are sealed during the window via a MagicBlock ephemeral rollup; only the aggregate outcome is committed on-chain, which prevents a public tally from collapsing into a bandwagon.
- **Supermajority** — a single outcome must reach the configured `supermajority_bps` threshold, otherwise the vote resolves `Unresolvable`.

## Asset

USDC is the single protocol asset for all bonds, voting stake, rewards, slashing, and treasury fees. The mint is a config field (currently `pusd_mint` on-chain; renaming to `usdc_mint`) so localnet/devnet can use a test mint. See [ADR-0004](docs/adr/0004-single-asset-usdc.md).

## Quickstart

```bash
# Install deps
bun install

# Build the program
anchor build

# Run the logic suite on localnet (mock-llm)
bun run test:local
```

**Requirements:** Solana CLI 3.1+ (tested on 4.0.1), Anchor 1.1.2, surfpool 1.4+, Bun, Rust 1.89.0

TypeScript integration tests use `@anchor-lang/core` with artifacts from `anchor build` (`target/idl/opal.json`, `target/types/opal.ts`).

### Web frontend

Privy social login + embedded Solana wallet (devnet). Assertion UI uses mock data until on-chain txs are wired:

```bash
cd web && cp .env.local.example .env.local && bun run check-env && bun run dev
```

See [web/README.md](web/README.md) and [Privy setup](web/docs/PRIVY_SETUP.md).

## Documentation

- [Web frontend](web/README.md) — Privy auth, devnet wallet, mock assertion flows
- [Privy setup](web/docs/PRIVY_SETUP.md) — dashboard checklist
- [Architecture](docs/architecture.md) — account model, state machine, instruction flow
- [Resolution](docs/resolution.md) — how statements move from assertion to final outcome
- [Tokenomics](docs/tokenomics.md) — bonds, slashing, rewards, fees
- [Glossary](docs/glossary.md) — shared vocabulary
- [Decision records](docs/adr/) — the rationale behind the locked design

## Testing

Tests are TypeScript integration tests run with `@anchor-lang/core`; there are no Rust unit tests. Targets split by environment ([ADR-0006](docs/adr/0006-codebase-organization.md)):

```bash
# [Built] Logic suite on surfpool (Anchor v1's default local runner), built with the mock-llm feature
bun run test:local

# [MVP-target] Real integration against devnet, where the trusted resolver
# and MagicBlock ER actually exist (no mock): anchor test --skip-local-validator
anchor test
```

`bun run test:local` is wired today (`anchor build -- --features mock-llm && anchor test --skip-build`). Pointing `anchor test` at devnet — a funded devnet keypair, a deployed program, and `--skip-local-validator` — lands in the test-split follow-up PR per ADR-0006; until then it still spins up a local surfpool network.

Current coverage: happy paths (undisputed, LLM resolution, full escalation), config validation, deadline violations, state guards, account mismatches, token balance assertions.

## Current State

The optimistic core is built: the account model, the six-state machine (`Asserted` → `PendingLLM` → `AssertedLLM` → `PendingVote` → `Voting` → `Resolved`), and the optimistic-resolution plus dispute plumbing all exist on-chain today. Integration tests drive the LLM round through a `mock-llm` path.

These pieces are v1 targets, not yet shipped:

- **Trusted LLM resolver** — the authority-gated path where a real LLM verdict is posted on-chain is the production target; the former 3-feed Switchboard council was removed per ADR-0002, so today the `mock-llm` path is the only resolution driver. On-chain LLM provenance (prompt/response/evidence hashing) is deferred to a `[Vision]` trust-minimized resolver.
- **Private staked voting** — opening a vote sets up the round, but real MagicBlock private voting (delegation, ER settlement) is the MVP target.
- **Resolution Spec on Arweave** — the on-chain `auxiliary_hash` field exists; off-chain Arweave storage and integrity-checking is planned.
- **No-fault settlement & reward split** — `Unresolvable` no-fault settlement and the share-based settlement split (`llm_disputer_reward_share_bps`, `vote_disputer_reward_share_bps`, `voter_reward_share_bps`, `treasury_share_bps`) are planned; only `protocol_fee_bps` is applied today.
- **Field names** — state and config fields still carry the legacy `pusd` prefix; a later PR renames them to `usdc` to match the committed asset.

## Vision (post-MVP)

Directions recorded so they're not mistaken for current behavior:

- **OPAL token** — governance, reputation/staking, voter incentives. Dropped from the MVP; staked USDC and the `authority` keypair cover its jobs.
- **Trust-minimized LLM** — Switchboard On-Demand or TEE-attested (permissionless) inference replacing the trusted resolver; on-chain LLM provenance hashing, if any, lands here.
- **Proof-of-personhood** — enabling sub-linear/quadratic voting weight without Sybil collapse.
- **Stake-duration reputation** — long-term staking that accrues voter weight.
- **Timed resolution** — assertions carrying a resolves-at date so they can't finalize before the truth exists.

## Security

Not audited. Don't use in production.

## License

Not selected yet.
