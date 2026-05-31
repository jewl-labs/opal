# Opal

A Solana-native optimistic oracle for natural-language statements.

Opal treats assertions as true by default. If nobody disputes within a liveness window, the assertion resolves `True`. If disputed, it escalates through an LLM resolution round and (if challenged) a voting round.

Target use case: prediction-market resolution. Statements like "Kanye West's Delhi concert got postponed" can't be answered by price feeds or APIs — they need a purpose-built oracle.

## How It Works

1. **Assert** — someone posts a statement with a stablecoin bond
2. **Wait** — liveness window where anyone can dispute
3. **Undisputed** — if no dispute, resolves `True`
4. **Disputed** — first dispute triggers LLM resolution (Switchboard in v1)
5. **Challenged** — if the LLM result is challenged, escalate to voting (MagicBlock in v1)
6. **Resolved** — final outcome is posted on-chain

## Resolution Outcomes

- `True` — statement is correct
- `False` — statement is incorrect
- `TooEarly` — reserved for future use
- `Unresolvable` — reserved for future use

## Quickstart

```bash
# Install deps
bun install

# Build the program
anchor build

# Run integration tests on localnet
anchor test
```

**Requirements:** Solana CLI v3.1.12 , Anchor 0.32.1, Bun, Rust 1.89.0

TypeScript integration tests use `@coral-xyz/anchor` with artifacts from `anchor build` (`target/idl/opal.json`, `target/types/opal.ts`).

### Web frontend

Social login + mock assertion UI (no on-chain txs yet):

```bash
cd web && cp .env.local.example .env.local && bun run check-env && bun run dev
```

See [web/README.md](web/README.md) and [Privy setup](web/docs/PRIVY_SETUP.md).

## Documentation

- [Web frontend](web/README.md) — Privy auth, mock assertion UI
- [Privy setup](web/docs/PRIVY_SETUP.md) — dashboard checklist
- [Architecture](docs/architecture.md) — account model, state machine, instruction flow
- [Resolution](docs/resolution.md) — how statements move from assertion to final outcome
- [Tokenomics](docs/tokenomics.md) — bonds, slashing, rewards, fees
- [Glossary](docs/glossary.md) — shared vocabulary

## Testing

All tests are TypeScript integration tests against a localnet validator. There are no Rust unit tests.

```bash
anchor test          # localnet
```

Current coverage: happy paths (undisputed, LLM resolution, full escalation), config validation, deadline violations, state guards, account mismatches, token balance assertions.

## Current State

This is an active scaffold. Several pieces are placeholder:

- **LLM resolver:** `submit_mock_llm_resolution` is a mock gated to protocol authority. Real Switchboard integration is reserved for future work.
- **Voting:** `open_vote` is permissionless and sets a `delegated` flag but performs no actual MagicBlock ER delegation. Real private voting is reserved for future work.
- **Tokenomics:** `voter_reward_share_bps` and `vote_disputer_reward_share_bps` exist in config but are not distributed. The vote disputer currently only gets their bond back (minus fees) if correct.
- **Field names:** still say `pusd` throughout. A future PR will rename to `usd` to reflect that any USD-pegged stablecoin is supported.

## Security

Not audited. Don't use in production.

## License

Not selected yet.
