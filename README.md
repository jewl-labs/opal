# Opal

Opal is a Solana-native optimistic oracle for verifying natural language statements. It is designed for statements based on real-world events that price feeds, APIs, and deterministic onchain data cannot safely answer on their own.

The first target use case is prediction-market resolution. A market or application can ask Opal to resolve statements like:

```text
Kanye West's Delhi concert got postponed.
```

Assertions are treated as true by default during a liveness window. If nobody disputes the statement, it finalizes as `True`. If someone disputes it, they post collateral and the statement moves through Opal's resolution flow.

## How It Works

1. An asserter submits a natural-language statement and posts a PUSD bond.
2. The assertion enters `Asserted`, where the default optimistic answer is `True`.
3. If no one disputes before the liveness window expires, the assertion finalizes as `Resolved(True)`.
4. If the assertion is disputed, the first dispute creates an `LLMResolutionRound`.
5. The v1 LLM resolver uses Switchboard On-Demand/Oracle Quotes to post a proposed outcome.
6. If the LLM result is not challenged, it becomes the final outcome.
7. If the LLM result is challenged, the assertion escalates to OPAL-weighted private voting through MagicBlock.
8. Once voting settles, the assertion becomes `Resolved` and consumers can safely read `AssertionAccount.outcome`.

## Resolution Outcomes

Opal supports four outcomes:

- `True` - the statement is verified as correct.
- `False` - the statement is verified as incorrect.
- `TooEarly` - the statement cannot be resolved yet because the relevant real-world truth does not exist or has not been published at resolution time.
- `Unresolvable` - the statement cannot be safely resolved from available evidence, auxiliary data, or voting consensus.

## Protocol Shape

Opal uses separate accounts for the main assertion, first dispute, second dispute, LLM resolution, and vote resolution:

- `AssertionAccount`
- `LLMDisputeAccount`
- `VoteDisputeAccount`
- `LLMResolutionRound`
- `VoteResolutionRound`
- `VoteRecord`
- `BondVault`
- `ProtocolConfig`
- `Treasury`

The assertion stores the statement, an `auxiliary_hash` pointing to offchain resolution guidance, lifecycle state, dispute pointers, resolution round pointers, and final outcome. It does not store the full auxiliary data or a tentative-resolution field.

## Economic Model

- PUSD is used for assertion bonds, dispute bonds, slashing, rewards, and treasury fees.
- OPAL is used for voting weight, governance/config control, and voter incentives.
- The first dispute challenges the default optimistic `True` answer.
- The second dispute challenges the LLM result.
- Vote influence is intended to use time-weighted average voting: `locked_opal * time_weight`.

## External Systems

Opal currently assumes these integrations:

- Switchboard On-Demand/Oracle Quotes for the v1 LLM resolution path.
- MagicBlock Private Ephemeral Rollups for private OPAL voting.
- MagicBlock Private Payments API as optional OPAL custody plumbing, not as the vote-casting mechanism itself.
- Nosana and/or an LLM Council as future resolver-hardening paths.

## Documentation

The main design docs live in `docs/`:

- [Glossary](docs/glossary.md) - shared vocabulary and protocol terms.
- [Architecture](docs/architecture.md) - account model, state machine, instruction flow, and integration boundaries.
- [Resolution](docs/resolution.md) - how statements move from assertion to final outcome.
- [Tokenomics](docs/tokenomics.md) - PUSD collateral, OPAL voting, dispute correctness, rewards, and slashing.

## Repository Status

This repository is currently in the documentation and protocol-design stage. Program code, clients, tests, and deployment tooling are not yet finalized.

## Building

Placeholder. Build instructions will be added once the Solana program and client workspace are scaffolded.

Expected future sections:

- Solana/Anchor program build
- TypeScript client build
- Generated SDK/client build

## Testing

Placeholder. Test instructions will be added once implementation begins.

Expected future coverage:

- State transition tests
- Dispute correctness tests
- Switchboard result verification tests
- MagicBlock voting/delegation tests
- Token settlement and slashing tests

## Local Development

Placeholder. Local development instructions will be added with the first implementation scaffold.

Expected future requirements:

- Solana CLI
- Anchor
- Node.js or Bun
- Switchboard SDK
- MagicBlock Ephemeral Rollups SDK

## Deployment

Placeholder. Deployment instructions and network addresses will be added when devnet/mainnet targets are chosen.

Expected future sections:

- Program deployment
- Protocol config initialization
- Treasury setup
- Switchboard feed setup
- MagicBlock validator/endpoint configuration

## Security

Placeholder. Security policy and audit notes will be added before production deployment.

Areas that need review:

- Bond and slashing economics
- Switchboard feed identity and staleness verification
- MagicBlock delegated-state lifecycle
- OPAL voting concentration and manipulation resistance
- Integrator finality guarantees

## License

Placeholder. License has not been selected yet.
