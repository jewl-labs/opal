# Opal Glossary

Opal is a Solana optimistic oracle that resolves **rubric-relative truth**: every assertion ships its own Resolution Spec saying _how_ it should be judged, and Opal applies that spec rather than adjudicating any universal truth. Statements are treated as `True` by default unless an economically-incentivized disputer challenges them — so no external monitoring/bot layer is required.

This glossary is the shared vocabulary and domain model. Mechanics live in [architecture.md](architecture.md), [resolution.md](resolution.md), and [tokenomics.md](tokenomics.md); the rationale behind the big decisions lives in [adr/](adr/).

## Status legend

Every feature is tagged so you never have to guess what's real:

- **`[Built]`** — implemented in the program today.
- **`[MVP-target]`** — committed for the MVP, not yet built. Build toward this.
- **`[Vision]`** — post-MVP / aspirational. Do **not** build it yet.

## Core concepts

**Opal**
A Solana-native optimistic oracle for natural-language statements, resolved relative to each assertion's Resolution Spec. Default-`True`; disputes escalate through an LLM resolution round and, if challenged, a staked private vote.

**Assertion** — `AssertionAccount` `[Built]`
The on-chain object created when an asserter posts a statement, a USDC bond, and a Resolution Spec.

**Statement** — `statement: [u8; 280]` `[Built]`
The short human-readable sentence whose truth is asserted. Null-terminated, stored on-chain.

**Resolution Spec** — `auxiliary_hash` + off-chain content `[MVP-target]`
The asserter-supplied rubric that defines _how_ the statement resolves: authoritative sources and their priority, key definitions, ambiguity handling, and when the statement becomes resolvable. **It is the source of truth** — the LLM resolver and voters apply it; they do not judge absolute reality. The spec lives off-chain on Arweave (permanent, content-addressed); only its hash is stored on-chain (`auxiliary_hash`, ≤128 bytes), so anyone can fetch it and verify integrity. See [ADR-0001](adr/0001-rubric-relative-truth.md).
_Avoid_: "auxiliary data" framed as optional hints; "evidence" — it is the spec, not a hint.

**Rubric-relative truth** `[MVP-target]`
Opal's core stance: the same statement text can resolve differently across assertions because each carries its own spec. "True" means "true under this assertion's fine print," which the asserter declares as the source of truth for their use case — not a universal fact.
_Avoid_: "absolute truth", "ground truth".

**Final Outcome** — `outcome: u8` `[Built]`
The terminal result on the assertion; `OUTCOME_NONE` (255) until `state == Resolved`. Consumers should ignore it unless `state == Resolved`.

## States & outcomes

**Assertion State** — raw `u8` `[Built]`

- `Asserted` (0) — liveness; default `True`; first dispute allowed.
- `PendingLLM` (1) — first dispute filed; awaiting the LLM verdict.
- `AssertedLLM` (2) — LLM verdict posted; challenge window open.
- `PendingVote` (3) — LLM verdict challenged; vote round initializing.
- `Voting` (4) — staked private vote active/settling.
- `Resolved` (5) — terminal; `outcome` set.

**Resolution Outcome** — raw `u8`

- `True` (0) `[Built]` — verified under the spec.
- `False` (1) `[Built]` — contradicted under the spec.
- `Unresolvable` (3) `[MVP-target]` — cannot be decided under the spec (ambiguous, conflicting, premature, or below the vote's supermajority). Settles **no-fault** (see Economics).
- `TooEarly` (2) — the code value persists and `validate_outcome_code` still accepts it; no path is intended to emit it. **Merging it into `Unresolvable` is `[MVP-target]`.** _Avoid_ treating it as a distinct outcome.
- `None` (255) — sentinel for unset.

## Participants

**Asserter** — `asserter` `[Built]` — posts an assertion, its spec, and the USDC bond.
**Disputer** — challenges the current answer by posting a USDC bond.
**LLM Disputer** `[Built]` — the first disputer; challenges the default `True` and triggers LLM resolution.
**Vote Disputer** `[Built]` — the second disputer; challenges the LLM verdict and triggers the staked vote.
**Voter** `[MVP-target]` — anyone who stakes USDC into a specific vote round; weight is linear in stake; wrong-side stake is slashed, right-side stake earns rewards.
**LLM Resolver** `[MVP-target]` — a trusted, authority-gated off-chain service that calls one LLM and posts the verdict. (On-chain LLM provenance hashing is deferred to `[Vision]`.) See [ADR-0002](adr/0002-trusted-llm-resolver.md).
_Avoid_: "council" for the resolver — the 3-feed Switchboard council was removed per ADR-0002 and was never the resolver design.
**Integrator** — any app consuming Opal outcomes; must read the Resolution Spec to judge whether an outcome is meaningful for its use case, and should require `state == Resolved` before irreversible settlement.

## Economics

**USDC** `[MVP-target]` — the single protocol asset, used for all bonds, voting stake, rewards, slashing, and treasury fees. The mint is a config field (currently `pusd_mint` on-chain; renaming to `usdc_mint` per ADR-0004) so localnet/devnet can use a test mint. See [ADR-0004](adr/0004-single-asset-usdc.md).
_Avoid_: calling the asset "pusd" (it is USDC — `pusd` is only the legacy on-chain field prefix, renaming per ADR-0004); "any USD-pegged stablecoin" (we commit to USDC); "OPAL" (dropped from the MVP).

**Assertion Bond / Dispute Bond** `[Built]` — USDC collateral posted by the asserter / a disputer. A dispute bond is `assertion_bond × ratio_bps / 10_000`.

**Slashing** `[MVP-target]` — loss of bond or staked vote weight for being on the wrong side of a finalized dispute or vote.

**Schelling-point vote** `[MVP-target]` — the staked vote is a coordination game on the truth: losing-side voters are slashed and winning-side voters are paid from the losing side, so the equilibrium is to vote the spec's honest answer. Security comes from this slashing, not from any weight curve. See [ADR-0003](adr/0003-private-staked-voting.md).

**No-fault settlement** `[MVP-target]` — when an assertion resolves `Unresolvable`, all bonds are returned and no one is slashed; the assertion is voided. See [ADR-0005](adr/0005-no-fault-unresolvable.md).
_Avoid_: the legacy `!= True ⇒ disputer correct` rule, which slashed on indeterminate outcomes.

**Settlement Split** `[MVP-target]` — the slashed pot is divided by configured shares (`llm_disputer_reward_share_bps`, `vote_disputer_reward_share_bps`, `voter_reward_share_bps`, `treasury_share_bps`, summing ≤ 100%). Today only `protocol_fee_bps` is applied `[Built]`; the share-based split is `[MVP-target]`.

## Voting `[MVP-target]`

**Vote Round** — `VoteResolutionRound` — the per-dispute staked vote that produces the final outcome when an LLM verdict is challenged.
**Linear weight** — 1 staked USDC = 1 vote. Sybil-neutral; whale dominance is deterred by slashing, not by a curve.
**Private vote (MagicBlock)** — votes are sealed during the window via a MagicBlock private ephemeral rollup; only the aggregate outcome is committed on-chain. Sealing prevents the bandwagon/beauty-contest collapse a public tally would cause. See [ADR-0003](adr/0003-private-staked-voting.md).
**Supermajority** — `supermajority_bps` (e.g. 6700) — the weighted threshold a single outcome must reach, otherwise the vote resolves `Unresolvable`.

## Vision (post-MVP) `[Vision]`

Recorded so the direction is clear and nobody mistakes these for current behaviour:

- **OPAL token** — governance, future reputation/staking, voter incentives. Dropped from the MVP (USDC + the authority key replace it).
- **Trust-minimized / permissionless LLM** — Switchboard On-Demand feed(s) or TEE-attested inference, replacing the trusted resolver. (The 3-feed Switchboard "council" was removed per ADR-0002.)
- **Proof-of-personhood** — to enable sub-linear/quadratic weighting without Sybil collapse.
- **Stake-duration reputation** — long-term staking that accrues voter weight/reputation.
- **Timed resolution** — assertions carry a resolves-at date and can't finalize before the truth exists.
- **TWAV (time-weighted voting)** — considered and rejected; recorded so it isn't reintroduced.
- **Nosana inference**; **on-chain commit-reveal** (the alternative to MagicBlock for private voting).
