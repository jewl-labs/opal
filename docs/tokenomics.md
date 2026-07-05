# Opal Tokenomics

Opal uses a **single asset: USDC** `[MVP-target]`. The same token is collateral for assertion bonds, dispute bonds, voting stake, slashing, rewards, and treasury fees. There is no second protocol token in the MVP — governance is the `authority` keypair, and voting weight is staked USDC, not a governance token. See [ADR-0004](adr/0004-single-asset-usdc.md).

> **Field-name note.** The program structs still use the legacy `pusd` prefix (`pusd_mint`, `assertion_bond_min_pusd`, `*_bond_amount_pusd`). These name a USDC amount; a later PR renames `*_pusd → *_usdc` and `pusd_mint → usdc_mint`. Treat every `pusd` field as USDC.

For the lifecycle and state machine these economics drive, see [architecture.md](architecture.md) and [resolution.md](resolution.md); the shared vocabulary lives in [glossary.md](glossary.md).

## Asset: USDC `[MVP-target]`

USDC is used for assertion bonds, the first (LLM) dispute bond, the second (vote) dispute bond, voting stake, slashed collateral, disputer and voter rewards, and protocol treasury fees. The mint is a config field (`pusd_mint`, to become `usdc_mint`) so localnet/devnet can run against a test mint, but the protocol commits to USDC — we do **not** support "any USD-pegged stablecoin." See [ADR-0004](adr/0004-single-asset-usdc.md).

## Bond Model `[Built]`

### Assertion Bond

The asserter posts a USDC bond when creating an assertion. The bond makes incorrect statements costly and funds rewards when a dispute is correct.

The minimum bond is configured in `ProtocolConfig.assertion_bond_min_pusd`; the posted amount is stored on the assertion as `assertion_bond_amount_pusd`.

### First Dispute Bond (LLM)

The LLM disputer posts a USDC bond to challenge the default optimistic `True` resolution and trigger LLM resolution. The amount is:

```text
llm_dispute_bond = assertion_bond * llm_dispute_bond_ratio_bps / 10_000
```

This creates economic symmetry and prevents free griefing. The posted amount is stored as `LlmDisputeAccount.bond_amount_pusd`.

### Second Dispute Bond (Vote)

The vote disputer posts a USDC bond to challenge the LLM verdict and open the private staked vote. The amount is:

```text
vote_dispute_bond = assertion_bond * vote_dispute_bond_ratio_bps / 10_000
```

The posted amount is stored as `VoteDisputeAccount.bond_amount_pusd`.

## Dispute Correctness `[Built]`

The first dispute always challenges the default `True` answer, so it does not store a challenged resolution. The second dispute records the LLM result it challenged (`VoteDisputeAccount.challenged_llm_resolution`).

Both dispute accounts carry a `settlement_resolution`, the outcome that settlement is judged against:

- First dispute: the LLM outcome if no vote happens, or the final vote outcome if the LLM verdict is challenged.
- Second dispute: always the final vote outcome.

A dispute is **correct** when the settled outcome contradicts the answer it challenged — for a genuine `True`/`False` settlement; an `Unresolvable` settlement is no-fault (below) and assigns no correctness:

```text
llm_dispute_correct  = settlement_resolution != True
vote_dispute_correct = settlement_resolution != challenged_llm_resolution
```

Today the LLM-dispute rule slashes the asserter on **any** non-`True` outcome (`False`, plus the still-accepted `TooEarly`/`Unresolvable` codes), not only on a genuine `False`. This is the legacy `!= True` rule, which wrongly assigns fault on indeterminate outcomes.

> **No-fault override** `[MVP-target]`. When `settlement_resolution` is `Unresolvable`, neither side is "correct" or "wrong" — the assertion settles no-fault (below). This **replaces** the legacy `settlement_resolution != True ⇒ disputer correct` rule, which wrongly slashed the asserter (or, under a True-fallback, the disputer) whenever the outcome was merely indeterminate. Only a genuine `True`/`False` settlement assigns fault. See [ADR-0005](adr/0005-no-fault-unresolvable.md).

## Settlement Defaults

### Undisputed Assertion `[Built]`

If the liveness window expires with no dispute:

- the assertion resolves `True`,
- the asserter bond is returned minus the protocol fee (`protocol_fee_bps`),
- the treasury receives the fee.

### Unresolvable — No-Fault `[MVP-target]`

If the settled outcome is `Unresolvable` (ambiguous, conflicting, premature, or below the vote's `supermajority_bps`):

- both the asserter bond and any disputer bond(s) are **returned in full**,
- no one is slashed and no fee is taken,
- the assertion is **voided** — re-assert later if it becomes determinable.

Merging `TooEarly` into `Unresolvable` is `[MVP-target]`; the `OUTCOME_TOO_EARLY` (2) constant persists and `validate_outcome_code` still accepts it, but no path is intended to emit it. See [ADR-0005](adr/0005-no-fault-unresolvable.md).

### First Dispute Settles Correct (`False`) `[Built]`

If the LLM disputer was correct:

- the LLM disputer wins,
- the LLM disputer receives their bond + the assertion bond minus the protocol fee,
- the treasury receives the fee.

### First Dispute Settles Incorrect (`True`) `[Built]`

If the LLM disputer was incorrect:

- the asserter wins,
- the asserter receives their bond + the LLM disputer bond minus the protocol fee,
- the treasury receives the fee.

### Vote Dispute Settlement `[Built]`

If the vote disputer was correct (`settlement_resolution != challenged_llm_resolution`), their bond is returned; if incorrect, their bond is slashed into the winner's payout (or treasury). Today only `protocol_fee_bps` is applied at settlement — the share-based reward split below is the `[MVP-target]` mechanism that pays winners (including the vote disputer) out of the losing side.

## Settlement Split & Voter Rewards `[MVP-target]`

The staked vote is a Schelling-point game (next section): losing-side voters are slashed, and **winning-side voters are paid from the losing side**. The split is governed by four configured shares on `ProtocolConfig`:

```text
llm_disputer_reward_share_bps
+ vote_disputer_reward_share_bps
+ voter_reward_share_bps
+ treasury_share_bps
<= 10_000        // sum may not exceed 100%
```

The protocol validates that the shares sum to at most `10_000` bps (100%). Each share routes a slice of the slashed pot to the winning LLM disputer, the winning vote disputer, the winning-side voters, and the treasury respectively.

> **Built today vs. target.** Only `protocol_fee_bps` is applied during settlement today `[Built]`. The share-based distribution (`llm_disputer_reward_share_bps`, `vote_disputer_reward_share_bps`, `voter_reward_share_bps`, `treasury_share_bps`) is the `[MVP-target]` mechanism, landing with the MagicBlock private vote: no voters are created or paid until the staked vote is integrated. The fields exist in `ProtocolConfig` today; the settlement logic that consumes them does not yet.

## Security Model `[MVP-target]`

Voting weight is **linear**: 1 staked USDC = 1 vote. Security does **not** come from a weight curve — no per-token curve resists both whales and Sybils, since they are the same dial. It comes from **slashing**: being on the losing side of a finalized vote costs money, which is Sybil-neutral and whale-deterring. With slashing as the backstop, weight stays linear and Sybil-neutral.

The vote is private during the voting window (a MagicBlock ephemeral rollup seals individual stakes/votes; only the aggregate outcome is committed on-chain). Sealing removes the visible running tally, so voters can't bandwagon onto a leader and must coordinate on the only remaining focal point — the honest answer under the Resolution Spec. A single outcome must reach `supermajority_bps` (a config field, e.g. `6700` in tests — not a hardcoded constant) or the vote settles `Unresolvable`. See [ADR-0003](adr/0003-private-staked-voting.md).

## Vision (post-MVP) `[Vision]`

Recorded so the direction is clear and nobody mistakes these for current behaviour:

- **OPAL token** — a protocol token for governance, future staking/reputation, and voter participation incentives. Dropped from the MVP: staked USDC supplies voting weight and the `authority` keypair supplies governance. See [ADR-0004](adr/0004-single-asset-usdc.md).
- **Stake-duration reputation** — long-term staking that accrues voter weight/reputation.
- **Timed resolution** — assertions carry a resolves-at date and cannot finalize before the truth exists (the more principled alternative to settling premature claims `Unresolvable`). See [ADR-0005](adr/0005-no-fault-unresolvable.md).
- **Proof-of-personhood** — to enable sub-linear/quadratic weighting without Sybil collapse.
