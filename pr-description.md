## Summary

Implements the full Switchboard oracle integration for LLM-based dispute resolution. When an assertion is disputed, an off-chain keeper triggers a Switchboard pull feed that calls a Claude-powered resolver, gets back an outcome code (0–3), and submits the oracle-verified result onchain in a single atomic transaction.

## What changed

**New instructions**

- `configure_llm_round` — authority commits the Switchboard queue pubkey, feed hash, and max staleness to the `LlmResolutionRound` account before the oracle fires. This prevents anyone from submitting a quote from a different feed after the fact.
- `submit_llm_resolution` — verifies a Switchboard On-Demand oracle quote using `QuoteVerifier` (reads the secp256k1 proof at `ix[0]` via the instructions sysvar), checks the queue and feed hash match what was committed, maps `feed.value()` to an outcome code, and writes the result onchain. The existing `submit_mock_llm_resolution` is kept for local tests.

**Off-chain keeper** (`client/submit-llm-resolution.ts`)

Reads the assertion statement and auxiliary data from chain, builds the Switchboard feed job definition (httpTask → jsonParseTask), derives the feed hash as `sha256(jobJson)`, calls `configure_llm_round`, then fetches the oracle quote via Crossbar and submits `[sigVerifyIx, submitLlmResolutionIx]` in one transaction.

**LLM resolver** (`resolver/server.ts`)

Bun HTTP server on `:3001/resolve`. Receives `{ statement, auxiliary_data }` from the Switchboard feed job, runs three layers of prompt injection defence, then calls Claude to evaluate the assertion and returns `{ outcome_code: N }`.

## Prompt injection defence

User-controlled content (statement + auxiliary data) never touches the system prompt. It is placed in the user turn inside XML delimiters and the model is primed to return UNRESOLVABLE if it detects instructions inside those tags.

| Layer | Mechanism |
|---|---|
| 1. Regex guard | Blocks classic patterns before any LLM call |
| 2. LLM classifier | Separate Claude call catches subtler rephrasing |
| 3. XML sandboxing | `<assertion>` / `<auxiliary_context>` tags isolate user content from system instructions |

## Onchain flow

```
dispute_assertion
  → configure_llm_round   (authority commits feedHash + queue)
  → Switchboard oracle    (calls /resolve, signs outcome_code)
  → submit_llm_resolution (verifies quote, writes outcome to LlmResolutionRound)
  → finalize_llm_resolution or challenge_llm_resolution
```

## Unit tests

7 new test cases covering `configure_llm_round` and `submit_llm_resolution` error paths:

| Test | Assertion |
|---|---|
| `configure_llm_round: stores oracle params` | queue, feedHash, maxStaleness written correctly |
| `configure_llm_round: can be updated by authority` | second call overwrites the first |
| `error: configureLlmRound rejects non-authority` | impostor keypair → `Unauthorized` |
| `error: configureLlmRound rejects wrong state` | called before dispute → `InvalidState` |
| `error: submitLlmResolution rejects wrong state` | called before dispute → `InvalidState` |
| `error: submitLlmResolution rejects mismatched queue` | wrong queue account → `InvalidFeed` |
| `error: submitLlmResolution rejects missing sigVerify` | no secp256k1 proof at ix[0] → `InvalidQuote` |

The happy path for `submit_llm_resolution` is covered by `submit_mock_llm_resolution` in the existing LLM resolution path test (real Switchboard oracle not available on localnet).

## Test plan

- [ ] `bun run test` — all existing and new localnet tests pass
- [ ] `bun run resolver` — server starts on `:3001` and returns correct outcome codes
- [ ] `bun run keeper <assertionPubkey>` — full flow runs end-to-end on devnet
- [ ] `configure_llm_round` rejects callers that are not the protocol authority
- [ ] `submit_llm_resolution` rejects a quote if queue or feed hash does not match committed values
- [ ] Resolver returns `3` (UNRESOLVABLE) on detected injection attempts in statement or auxiliary data
