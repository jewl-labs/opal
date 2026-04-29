# Opal

Opal is a Solana-native optimistic oracle for verifying natural language statements. It is designed for statements based on real-world events that price feeds, APIs, and deterministic onchain data cannot safely answer on their own.

The first target use case is prediction-market resolution. A market or application can ask Opal to resolve statements like:

```text
Kanye West's Delhi concert got postponed.
```

Assertions are treated as true by default during a liveness window. If nobody disputes the statement, it finalizes as `True`. If someone disputes it, they post collateral and the statement moves through Opal's resolution flow.

## How It Works

1. An asserter submits a natural-language statement and posts a stablecoin bond.
2. The assertion enters `Asserted`, where the default optimistic answer is `True`.
3. If no one disputes before the liveness window expires, the assertion finalizes as `Resolved(True)`.
4. If the assertion is disputed, the first dispute creates an `LLMResolutionRound`.
5. The v1 LLM resolver uses Switchboard On-Demand/Oracle Quotes to post a proposed outcome. _(placeholder: mock resolver used for local tests)_
6. If the LLM result is not challenged, it becomes the final outcome.
7. If the LLM result is challenged, the assertion escalates to OPAL-weighted private voting through MagicBlock. _(placeholder: no real voting yet)_
8. Once voting settles, the assertion becomes `Resolved` and consumers can safely read `AssertionAccount.outcome`.

## Resolution Outcomes

Opal supports four outcomes:

- `True` — the statement is verified as correct.
- `False` — the statement is verified as incorrect.
- `TooEarly` — reserved. Not used in current resolution paths.
- `Unresolvable` — reserved. Not used in current resolution paths.

## Protocol Shape

Opal uses separate accounts for the main assertion, first dispute, second dispute, LLM resolution, and vote resolution:

- `AssertionAccount`
- `LlmDisputeAccount`
- `VoteDisputeAccount`
- `LlmResolutionRound`
- `VoteResolutionRound`
- `BondVault` (SPL token account)
- `ProtocolConfig`

The assertion stores the statement, an `auxiliary_hash` pointing to offchain resolution guidance, lifecycle state, dispute pointers, resolution round pointers, and final outcome.

## Economic Model

- Stablecoin (currently generic — any USD-pegged token) is used for assertion bonds, dispute bonds, slashing, rewards, and treasury fees.
  > Note: field names still say `pusd` throughout the program — a future PR will rename them to `usd`.
- OPAL is intended for voting weight, governance/config control, and voter incentives. _(not yet integrated)_
- The first dispute challenges the default optimistic `True` answer.
- The second dispute challenges the LLM result.
- Vote influence is intended to use time-weighted average voting: `locked_opal * time_weight`. _(not yet implemented)_

## External Systems

Opal currently assumes these integrations:

- **Switchboard On-Demand/Oracle Quotes** for the v1 LLM resolution path. _(placeholder fields reserved; mock resolver used locally)_
- **MagicBlock Private Ephemeral Rollups** for private OPAL voting. _(placeholder fields reserved; no delegation logic yet)_
- **MagicBlock Private Payments API** as optional OPAL custody plumbing. _(not yet integrated)_

## Documentation

The main design docs live in `docs/`:

- [Glossary](docs/glossary.md) — shared vocabulary and protocol terms.
- [Architecture](docs/architecture.md) — account model, state machine, instruction flow, and integration boundaries.
- [Resolution](docs/resolution.md) — how statements move from assertion to final outcome.
- [Tokenomics](docs/tokenomics.md) — stablecoin collateral, OPAL voting, dispute correctness, rewards, and slashing.

## Building

```bash
# Build the Anchor program (generates IDL automatically)
anchor build

# Regenerate TypeScript client from IDL (only needed after IDL changes)
bun run gen:client
```

**Build order:** `anchor build` first — it writes `target/idl/opal.json`, which `gen:client` reads.

> `bun run gen:client` is currently broken (Codama circular-dependency error in the IDL).
> The IDL and `target/types/opal.ts` from `anchor build` are sufficient for tests.

## Testing

```bash
# Run all integration tests on localnet
# (auto-starts validator, deploys program, runs tests, stops validator)
anchor test

# Devnet tests (requires pre-deployed program and .env with KEYPAIR_BYTES/CLUSTER)
bun run test:devnet
```

> There are no Rust unit tests — `cargo test -p opal` only runs the empty harness.
> All coverage lives in `tests/opal.test.ts`.
>
> The `finalizeVoteResolutionPlaceholder` instruction requires `skipPreflight: true`
> in test calls due to an Anchor/web3.js preflight simulation bug. The instruction
> itself is valid (`.simulate()` confirms this), but the standard `.rpc()` path
> throws a cryptic "Unknown action 'undefined'" without the flag.

Current test coverage:

- Undisputed assertion lifecycle
- LLM dispute → resolution → payout
- Full escalation: dispute → LLM → challenge → vote placeholder → resolution
- Config validation (invalid bond minimum rejected)
- Error cases: premature finalization, insufficient bond, deadline violations, wrong state transitions, mismatched accounts, duplicate disputes
- Token balance assertions for fee distribution and winner payouts

## Local Development

Requirements:

- Solana CLI
- Anchor 0.32.1
- Bun
- Rust 1.89.0 (pinned in `rust-toolchain.toml`)

```bash
# Install dependencies
bun install

# Build and test
anchor build && anchor test
```

## Deployment

Placeholder. Deployment instructions and network addresses will be added when devnet/mainnet targets are chosen.

## Security

This codebase is under active development and has not been audited. Do not use in production.

Areas that need review:

- Bond and slashing economics
- Switchboard feed identity and staleness verification
- MagicBlock delegated-state lifecycle
- OPAL voting concentration and manipulation resistance
- Integrator finality guarantees

## License

Placeholder. License has not been selected yet.
