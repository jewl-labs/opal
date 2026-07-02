# Opal Resolution

Resolution is the process that turns the optimistic default answer into a final answer. An assertion starts in `Asserted`, where the statement is treated as `True` by default; disputes move it through an LLM resolution round and, if that is challenged, a private staked USDC vote.

Throughout, "truth" means **rubric-relative truth**: the answer is judged against the assertion's own Resolution Spec, not against universal reality. See the [glossary](glossary.md) for vocabulary and [ADR-0001](adr/0001-rubric-relative-truth.md) for the rationale.

## Assertion Requirements

Every assertion includes:

1. An on-chain `statement`: a short natural-language sentence (max 280 bytes, null-terminated). `[Built]`
2. An on-chain `auxiliary_hash`: the content hash of the off-chain **Resolution Spec** (max 128 bytes). `[Built]` (the field); `[MVP-target]` (the spec workflow)

### The Resolution Spec `[MVP-target]`

The Resolution Spec is the asserter-supplied rubric that defines _how_ the statement resolves: authoritative sources and their priority, key definitions, ambiguity handling, and when the statement becomes resolvable. **It is the source of truth.** The LLM resolver and the voters _apply_ the spec; they do not adjudicate absolute reality, so the same statement text can resolve differently across assertions. See [ADR-0001](adr/0001-rubric-relative-truth.md).

The spec lives off-chain on **Arweave** (permanent, content-addressed); only its hash is stored on-chain in `auxiliary_hash`, so anyone can fetch the spec and verify its integrity. The protocol does not enforce a schema for the spec content. If the spec is vague, missing, or contradictory, the statement is more likely to resolve `Unresolvable` — vetting the spec before trusting an outcome is the integrator's responsibility.

## Outcome Rules

The final `outcome: u8` is one of:

**`True` (0)** `[Built]`
The evidence, applied through the spec, verifies the statement.

**`False` (1)** `[Built]`
The evidence, applied through the spec, contradicts the statement.

**`Unresolvable` (3)** `[MVP-target]`
The statement cannot be decided under the spec: source priority is unclear, evidence conflicts or is unavailable, the statement is ambiguous, the spec is too weak, the truth does not exist yet, or the vote failed to reach `supermajority_bps`. Settles **no-fault** (see [Settlement Logic](#settlement-logic)).

**`TooEarly` (2)** — the code constant persists and `validate_outcome_code` still accepts it (0–3), but no path is intended to emit it (the council could, on a feed majority). **Merging it into `Unresolvable` is `[MVP-target]`**: "the real-world truth does not exist yet" is just one way to be `Unresolvable`, and the target is that it settles identically. See [ADR-0005](adr/0005-no-fault-unresolvable.md).

**`None` (255)** `[Built]` — sentinel for unset; the value of `outcome` until `state == Resolved`.

## Current Answer By State

`AssertionAccount` does not store a tentative-resolution field. The current non-final answer is inferred from `state` and the linked round accounts:

- `Asserted` (0): current non-final answer is the optimistic default `True`.
- `PendingLLM` (1): the default `True` has been disputed; no LLM verdict posted yet.
- `AssertedLLM` (2): current non-final answer is `LlmResolutionRound.outcome`.
- `PendingVote` (3): the LLM verdict has been challenged; vote setup is in progress.
- `Voting` (4): final answer is pending vote settlement.
- `Resolved` (5): final answer is `AssertionAccount.outcome`.

## Lifecycle

The six-state machine and its plumbing — account structs, transitions, and the optimistic + dispute flow — are `[Built]`. The trusted resolver and the private vote that ride on top are `[MVP-target]`; the current non-mock resolution path is a Switchboard council being removed per [ADR-0002](adr/0002-trusted-llm-resolver.md), and on localnet a mock LLM path stands in (see below).

### 1. Asserted `[Built]`

When an assertion is created (`create_assertion`):

- the asserter posts a USDC assertion bond (`assertion_bond_amount_pusd`; the field is renamed `*_usdc` in a later PR per [ADR-0004](adr/0004-single-asset-usdc.md))
- `state = Asserted`
- `outcome = None` (255)
- `liveness_deadline` is set from `liveness_window_seconds`
- `auxiliary_hash` points to the off-chain Resolution Spec

While `Asserted`, the statement is treated as `True` by default. The liveness window is the only time a first dispute can be filed; if it expires undisputed, the assertion can be finalized `True` (`finalize_undisputed`).

### 2. PendingLLM `[Built]` plumbing / `[MVP-target]` resolver

When the first dispute is filed (`dispute_assertion`):

- the LLM disputer posts a USDC dispute bond (`assertion_bond × llm_dispute_bond_ratio_bps / 10_000`)
- `LlmDisputeAccount` is created
- `LlmResolutionRound` is created
- `state = PendingLLM`
- `dispute_count = 1`

Today the non-mock resolution instruction `submit_llm_resolution` runs a **3-feed Switchboard council** `[Built]`: it reads `council_feeds` from the round, parses three Switchboard pull-feeds, and posts the majority verdict (a 1-1-1 tie falls back to `Unresolvable`). This path is compiled but has only ever been exercised via the mock on localnet, and it is slated for removal per [ADR-0002](adr/0002-trusted-llm-resolver.md).

The MVP target `[MVP-target]` is to replace the council with a single, authority-gated off-chain **trusted resolver** that makes one LLM call and posts the verdict via a resolution instruction. How that resolver integrates with the current program — replacing `submit_llm_resolution` versus a new instruction — is not yet settled. The LLM layer does not need to be trustless because the staked vote backstops it (a wrong verdict is challengeable). Binding LLM provenance (prompt/response/evidence hashes) on-chain for auditability is **not part of the MVP**; it is deferred to a `[Vision]` trust-minimized/permissionless resolver (see the note below).

On localnet, integration tests use `submit_mock_llm_resolution` instead (authority-gated, `mock-llm` build feature). `[Built]`

> On `LlmResolutionRound`, `council_feeds` **is** read by the current council path (`submit_llm_resolution`) and is required by `dispute_assertion` (which errors `CouncilFeedsNotConfigured` otherwise). The remaining Switchboard fields (`switchboard_program`, `switchboard_queue`, `switchboard_feed_hash`, `switchboard_quote`, `switchboard_quote_slot`, `max_staleness_slots`) and the four `*_hash` fields (`prompt_hash`, `variable_overrides_hash`, `response_hash`, `evidence_hash`) are currently unused — written to zero at dispute time and never read — and may be removed. The council path itself is slated for removal per [ADR-0002](adr/0002-trusted-llm-resolver.md); see [Vision](#vision-post-mvp).

### 3. AssertedLLM `[Built]`

When the LLM verdict is posted:

- `LlmResolutionRound.outcome` is set
- `state = AssertedLLM`
- the LLM challenge window opens (`llm_challenge_deadline`, from `llm_challenge_window_seconds`)

The current non-final answer is now the LLM result. If no second dispute is filed before `llm_challenge_deadline`, the assertion is finalized with the LLM outcome (`finalize_llm_resolution`).

### 4. PendingVote `[Built]` plumbing / `[MVP-target]` vote

When the LLM verdict is challenged (`challenge_llm_resolution`):

- the vote disputer posts a USDC dispute bond (`assertion_bond × vote_dispute_bond_ratio_bps / 10_000`)
- `VoteDisputeAccount` is created, recording `challenged_llm_resolution` (the LLM outcome being contested)
- `VoteResolutionRound` is created
- `state = PendingVote`
- `dispute_count = 2`

The assertion waits for voting to open.

### 5. Voting `[MVP-target]`

When `open_vote` is called:

- voting deadlines are set on `VoteResolutionRound` (`voting_starts_at`, `voting_deadline`)
- `state = Voting`

The vote is a private, per-dispute, USDC-staked Schelling-point vote with **linear weight** (1 staked USDC = 1 vote). Votes are kept private during the voting window via a **MagicBlock private ephemeral rollup** `[MVP-target]`: stake and vote amounts are sealed in the ER and only the aggregate outcome is committed back on-chain, which prevents the bandwagon collapse a public running tally would cause. A single outcome must reach `supermajority_bps` (a `ProtocolConfig` field, e.g. `6700`) or the vote resolves `Unresolvable`. See [ADR-0003](adr/0003-private-staked-voting.md).

> Today `open_vote` is permissionless and sets `delegated = BOOL_TRUE` without performing real MagicBlock delegation; the MagicBlock ER integration is the MVP's critical-path build. This is a build-toward target, not the intended end state.

### 6. Resolved `[Built]`

When a resolution path finalizes:

- `state = Resolved`
- `outcome` is set
- `finalized_at` is set
- dispute settlement fields (`settlement_resolution` on the dispute accounts) are populated
- bond redistribution occurs

Three paths lead to `Resolved`:

1. **Undisputed:** `finalize_undisputed` sets `outcome = True`.
2. **LLM resolution:** `finalize_llm_resolution` sets `outcome = LlmResolutionRound.outcome`.
3. **Vote resolution:** `finalize_vote_resolution_placeholder` sets the final outcome. It currently takes a mock outcome argument; real vote tallying from the MagicBlock aggregate is `[MVP-target]`.

## Settlement Logic

Settlement decides who is paid and who is slashed. The unit of account is USDC. Today only `protocol_fee_bps` is applied on the winning transfer `[Built]`; the share-based split of the slashed pot across `llm_disputer_reward_share_bps` / `vote_disputer_reward_share_bps` / `voter_reward_share_bps` / `treasury_share_bps` is `[MVP-target]`. See [ADR-0004](adr/0004-single-asset-usdc.md) for the single-asset model.

### Undisputed (`True`) `[Built]`

If the liveness window expires with no dispute:

- assertion resolves `True`
- asserter bond is returned minus the protocol fee
- treasury receives the fee

### Indeterminate (`Unresolvable`) — no-fault `[MVP-target]`

If any path produces `Unresolvable`, the assertion settles **no-fault**:

- both the asserter bond and every dispute bond are returned in full
- **no one is slashed** — not the asserter, not any disputer, not any voter
- the assertion is voided (it can be re-asserted later if it becomes determinable)

`Unresolvable` means nobody was provably wrong: the claim was not decidable under the spec. This **replaces** the legacy rule that treated any `outcome != True` as "disputer correct, asserter slashed," which unjustly slashed on indeterminate outcomes. A frivolous dispute on a genuinely resolvable claim still lands on `True`/`False` and is still slashed, so no-fault can't be gamed. See [ADR-0005](adr/0005-no-fault-unresolvable.md).

### First Dispute (LLM Resolution) — `True` / `False` `[Built]`

If `finalize_llm_resolution` settles a `True` or `False` outcome (no vote dispute filed):

- if the LLM disputer was correct (final outcome is `False` — the disputed default `True` was overturned):
  - the LLM disputer wins: receives their bond + the asserter bond, minus fee
- if the LLM disputer was incorrect (final outcome is `True`):
  - the asserter wins: receives their bond + the LLM disputer bond, minus fee
- treasury receives the fee

> Target `[MVP-target]`: `Unresolvable` takes the no-fault path above and does not flow through this win/lose branch. Today the code has no no-fault path — `Unresolvable` (like any `outcome != True`) still routes through the disputer-wins branch here (`llm_dispute_correct = final_outcome != OUTCOME_TRUE`), settling like `False`; this is the legacy behavior [ADR-0005](adr/0005-no-fault-unresolvable.md) replaces.

### Second Dispute (Vote Resolution) — `True` / `False` `[MVP-target]`

If the vote settles a `True` or `False` outcome, the vote outcome is final and settlement runs in two parts.

**Bond settlement** mirrors the first dispute, decided by the final outcome:

- if the final outcome overturned the default `True` (`False`), the LLM disputer side is the winner over the asserter; otherwise the asserter wins.
- the vote disputer is settled against the LLM verdict they challenged: if the final outcome differs from `challenged_llm_resolution`, the vote disputer was correct and their bond is returned (plus a reward share from the losing pot); if it matches, the vote disputer was wrong and their bond is slashed into the pot.

**Voter settlement (Schelling-point slashing):**

- losing-side voters are **slashed** — their staked USDC is forfeited into the pot
- winning-side voters are **paid from the losing side**, pro-rata to their linear weight, via `voter_reward_share_bps`
- security comes from this slashing, not from any weight curve

The slashed pot (losing bonds + losing stake) is divided by the configured `*_share_bps` shares. See [ADR-0003](adr/0003-private-staked-voting.md).

> The share-based split and voter payouts are not yet distributed in code; the `*_reward_share_bps` fields exist in `ProtocolConfig` and define the `[MVP-target]` behavior. The current `finalize_vote_resolution_placeholder` returns the vote disputer's bond with no positive incentive yet.

## Vision (post-MVP)

Recorded so the direction is clear and nobody mistakes these for current behavior:

- **Trust-minimized / permissionless LLM** — Switchboard On-Demand feed(s), TEE-attested, or otherwise permissionless inference replacing the trusted resolver; on-chain LLM provenance hashing, if any, would land here. The 3-feed Switchboard "council" (`council_feeds` / `set_council_feeds`, read by `submit_llm_resolution`) is the current non-mock resolution path `[Built]`, being removed per [ADR-0002](adr/0002-trusted-llm-resolver.md); its unused `switchboard_*` fields on `LlmResolutionRound` may be removed with it.
- **OPAL token** — governance and future voter incentives; dropped from the MVP, where governance is the `authority` keypair and stake is USDC. See [ADR-0004](adr/0004-single-asset-usdc.md).
- **Timed resolution** — assertions carry a resolves-at date and cannot finalize before the truth exists; a more principled alternative to `Unresolvable`-by-prematurity. See [ADR-0005](adr/0005-no-fault-unresolvable.md).
- **Proof-of-personhood / quadratic weighting** and **stake-duration reputation** — Sybil-resistant sub-linear voting and long-term voter reputation.
- **On-chain commit-reveal** — the considered-and-rejected alternative to MagicBlock for private voting, recorded so the trade-off isn't relitigated.
