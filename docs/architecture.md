# Opal Architecture

Opal is a Solana-native optimistic oracle for natural-language statements, resolved relative to each assertion's **Resolution Spec** (see [glossary.md](glossary.md) and [ADR-0001](adr/0001-rubric-relative-truth.md)). The protocol treats every new assertion as `True` by default during `Asserted`; disputers can challenge that default for direct economic upside, so the protocol design does not require an external monitoring or bot layer.

This document describes the target architecture for the prediction-market wedge. Resolution rules are detailed in [resolution.md](resolution.md), and economics are detailed in [tokenomics.md](tokenomics.md). Each section and feature is tagged `[Built]` (in the program today), `[MVP-target]` (committed, not yet built), or `[Vision]` (post-MVP); pure-`[Vision]` material is clustered at the end.

## Design Invariants

- `AssertionAccount` does not store a tentative resolution field. `[Built]`
- The current non-final answer is inferred from state: `Asserted` means default `True`; `AssertedLLM` means read `LlmResolutionRound.outcome`; `PendingVote` and `Voting` mean that LLM answer is under challenge and no final answer exists yet. `[Built]`
- `outcome` is unset (`OUTCOME_NONE`) until `state == Resolved`. `[Built]`
- `Asserted` and `AssertedLLM` are liveness states: the current answer can still be challenged. `[Built]`
- `PendingLLM` and `PendingVote` are intermediary states: a dispute has been accepted, but the next resolution layer is not finished or active yet. `[Built]`
- `Resolved` is terminal: `outcome` is set and irreversible consumers can settle. `[Built]`
- The statement lives onchain as a fixed-size byte array (null-terminated string, max 280 bytes). `[Built]`
- The Resolution Spec lives **off-chain on Arweave**; only `auxiliary_hash` is stored onchain (max 128 bytes) so anyone can fetch the spec and verify integrity. The spec **is the source of truth** — the LLM resolver and voters apply it, they do not adjudicate universal reality. `[MVP-target]` (see [ADR-0001](adr/0001-rubric-relative-truth.md))
- **USDC** is the single collateral asset for bonds, slashing, rewards, and fees. The mint is a config field (`pusd_mint`, slated to rename to `usdc_mint`) so localnet/devnet can use a test mint, but the protocol commits to USDC. `[MVP-target]` (see [ADR-0004](adr/0004-single-asset-usdc.md))
- Governance is the `authority` keypair. There is no separate governance token in the MVP. `[MVP-target]`
- LLM resolution is a **single trusted off-chain resolver** that posts the verdict via `submit_llm_resolution`, gated on the dedicated `ProtocolConfig.resolver` key `[Built]`; the off-chain resolver service is `[MVP-target]`. The former 3-feed Switchboard council was removed per [ADR-0002](adr/0002-trusted-llm-resolver.md). Binding LLM provenance hashes onchain is not part of the MVP — it is deferred to `[Vision]`.
- Final escalation is a **private, USDC-staked vote on a MagicBlock ephemeral rollup** with linear weight (1 USDC = 1 vote) and Schelling-point slashing. A single outcome must reach `supermajority_bps`, otherwise the vote resolves `Unresolvable`. `[MVP-target]` (see [ADR-0003](adr/0003-private-staked-voting.md))
- `Unresolvable` settles **no-fault**: both bonds returned, nobody slashed, assertion voided. `[MVP-target]` (see [ADR-0005](adr/0005-no-fault-unresolvable.md))

> Note on field names: account fields still carry the legacy `pusd` prefix (`assertion_bond_amount_pusd`, `bond_amount_pusd`, `pusd_mint`, …). These are USDC; the `*_pusd → *_usdc` / `pusd_mint → usdc_mint` rename is a separate follow-up PR.

## Onchain Account Model

All state accounts are **zero-copy** with `#[repr(C, packed)]`. They contain only primitive types (`u8`, `i64`, `Pubkey`, `[u8; N]`, `u64`, `u16`, `u128`). No `Option<T>`, `bool`, or enums are used inside zero-copy accounts; sentinels (`Pubkey::default()`, `0`, `255`) represent unset fields. `[Built]`

### `AssertionAccount` `[Built]`

The primary PDA for an assertion. It intentionally stores enough summary fields that an integrator can read one account and know the current state, whether the assertion was disputed once or twice, and which round accounts contain the LLM and vote resolutions.

```rust
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct AssertionAccount {
    pub id: Pubkey,
    pub asserter: Pubkey,
    pub statement: [u8; 280],
    pub auxiliary_hash: [u8; 128],
    pub bond_vault: Pubkey,
    pub state: u8,                  // ASSERTION_STATE_*
    pub liveness_deadline: i64,
    pub llm_challenge_deadline: i64,
    pub outcome: u8,                // OUTCOME_* (255 = unset)
    pub finalized_at: i64,          // 0 = unset
    pub dispute_count: u8,
    pub assertion_bond_amount_pusd: u64,
    pub llm_dispute: Pubkey,        // default = unset
    pub vote_dispute: Pubkey,       // default = unset
    pub llm_resolution_round: Pubkey,   // default = unset
    pub vote_resolution_round: Pubkey,  // default = unset
    pub bump: u8,
}
```

`auxiliary_hash` is the hash of the off-chain Resolution Spec; resolving the assertion means applying that spec, not judging absolute truth.

Implementation notes:

- On creation, `state = ASSERTION_STATE_ASSERTED`, `outcome = OUTCOME_NONE`, and `dispute_count = 0`.
- While `state = ASSERTED`, the current non-final answer is the optimistic default `True`.
- When the first dispute is filed, `dispute_count = 1`, `llm_dispute` is set, `llm_resolution_round` is set, and `state = PENDING_LLM`.
- When the LLM result is posted, `state = ASSERTED_LLM`; the current non-final answer is `LlmResolutionRound.outcome`.
- When the second dispute is filed, `dispute_count = 2`, `vote_dispute` is set, `vote_resolution_round` is set, and `state = PENDING_VOTE`.
- When voting is active, `state = VOTING`; the LLM result remains the challenged result until the vote resolves.
- When finalized, `state = RESOLVED` and `outcome` is set.

### Resolution Spec (Arweave + `auxiliary_hash`) `[MVP-target]`

The Resolution Spec is the asserter-supplied rubric — authoritative sources and their priority, key definitions, ambiguity handling, and when the statement becomes resolvable. It is the single most important artifact after the statement itself, because **it is the source of truth**: True means "true under this assertion's spec, correctly applied," not a universal fact (see [ADR-0001](adr/0001-rubric-relative-truth.md)).

- The spec lives off-chain on **Arweave** (permanent, content-addressed) and must stay retrievable and integrity-checkable for the whole assertion lifecycle.
- Only its hash is stored onchain in `AssertionAccount.auxiliary_hash` (≤128 bytes), so anyone can fetch the spec and verify it matches.
- The LLM resolver and the voters **apply** the spec; disputes and votes are framed as "applying this spec, the answer is X," not "in reality it's X."
- Vetting the spec is the integrator's responsibility: garbage spec in → garbage truth out, faithfully applied. An integrator must read the spec before trusting an outcome.

### `LlmDisputeAccount` `[Built]`

The first dispute account. It does not need to store the challenged resolution because the first dispute always challenges the default optimistic `True`.

```rust
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct LlmDisputeAccount {
    pub assertion: Pubkey,
    pub disputer: Pubkey,
    pub bond_amount_pusd: u64,
    pub created_at: i64,
    pub resolution_round: Pubkey,
    pub settlement_resolution: u8,  // 255 = unset
    pub bump: u8,
}
```

`settlement_resolution` records the outcome this dispute settled against: if the LLM result is not challenged, it is the LLM result; if it is challenged, it is the final vote result. Settlement does **not** use a blanket `!= True ⇒ disputer correct` rule — a `True`/`False` outcome slashes the wrong side via the configured share split, while an `Unresolvable` outcome settles no-fault (both bonds returned, nobody slashed). See [ADR-0005](adr/0005-no-fault-unresolvable.md) and [resolution.md](resolution.md). `[MVP-target]`

### `VoteDisputeAccount` `[Built]`

The second dispute account. It challenges the LLM result stored on `LlmResolutionRound`.

```rust
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct VoteDisputeAccount {
    pub assertion: Pubkey,
    pub disputer: Pubkey,
    pub challenged_llm_resolution_round: Pubkey,
    pub challenged_llm_resolution: u8,  // OUTCOME_*
    pub bond_amount_pusd: u64,
    pub created_at: i64,
    pub resolution_round: Pubkey,
    pub settlement_resolution: u8,  // 255 = unset
    pub bump: u8,
}
```

`settlement_resolution` is the final vote outcome. As above, `True`/`False` slashes the side that backed the other answer and an `Unresolvable` vote settles no-fault `[MVP-target]` (today the code treats any non-`True` outcome like `False`).

### `BondVault` `[Built]`

A PDA-controlled SPL token account that holds assertion and dispute collateral (USDC) until settlement. It is initialized alongside the assertion and uses the assertion's PDA as its authority.

### `LlmResolutionRound` `[Built]`

The account tracking LLM resolution for the first dispute. The former council/Switchboard fields (`council_feeds`, the `switchboard_*` fields, and the four `*_hash` provenance fields) were removed with the council path per [ADR-0002](adr/0002-trusted-llm-resolver.md). On-chain LLM provenance hashing would only land with a future `[Vision]` trust-minimized resolver whose shape is undecided, so this doc does not commit to any specific hash set.

```rust
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct LlmResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    pub outcome: u8,            // OUTCOME_* (255 = unset)
    pub requested_at: i64,
    pub resolved_at: i64,       // 0 = unset
    pub challenge_deadline: i64, // 0 = unset
    pub bump: u8,
}
```

`outcome` is an outcome code: `0 = True`, `1 = False`, `3 = Unresolvable`. The code `2` (`TooEarly`) persists in the constants and `validate_outcome_code` still accepts it, but `submit_llm_resolution` rejects it; merging it into `Unresolvable` is `[MVP-target]` (see [ADR-0005](adr/0005-no-fault-unresolvable.md)). Today the resolver key sets `outcome` from an argument via `submit_llm_resolution`; the `[MVP-target]` off-chain service sets it from its single LLM call.

### `VoteResolutionRound` `[Built]` (struct) / `[MVP-target]` (private vote)

The account tracking the private staked vote for the second dispute. The MagicBlock fields (`magicblock_validator`, `permission_account`, `delegated_vote_state`) and the `delegated` / `committed` lifecycle flags model the ephemeral-rollup delegation that the private vote runs on. In the current code these are wired structurally but the real ER vote is not yet implemented — `open_vote` advances the state machine and sets `delegated = BOOL_TRUE`, and `finalize_vote_resolution_placeholder` writes a supplied outcome. The MagicBlock private vote is the **MVP target**, not a permanent placeholder.

```rust
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct VoteResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    pub magicblock_validator: Pubkey,
    pub permission_account: Pubkey,
    pub delegated_vote_state: Pubkey,
    pub delegated: u8,          // BOOL_TRUE/BOOL_FALSE
    pub committed: u8,          // BOOL_TRUE/BOOL_FALSE
    pub voting_starts_at: i64,  // 0 = unset
    pub voting_deadline: i64,   // 0 = unset
    pub reveal_deadline: i64,   // 0 = unset
    pub total_valid_weight: u128,
    pub aggregate_votes: VotesPerOutcome,
    pub final_outcome: u8,      // OUTCOME_* (255 = unset)
    pub bump: u8,
}
```

`aggregate_votes` (`VotesPerOutcome`) is designed to accumulate per-outcome weight and `total_valid_weight` the weighted total `[MVP-target]`; today both are only initialized to zero and never written. The vote uses **linear weight** (1 staked USDC = 1 vote) and is settled by **Schelling-point slashing** — losing-side voters are slashed, winning-side voters are paid from the losing side. Votes are kept **private during the voting window** via the MagicBlock ephemeral rollup; only the aggregate outcome is committed onchain. `final_outcome` is `Unresolvable` if no single outcome reaches `supermajority_bps`. See [ADR-0003](adr/0003-private-staked-voting.md).

`PendingVote` exists so the protocol can create the vote round and set voting deadlines before moving to `Voting`.

### `ProtocolConfig` `[Built]`

Singleton PDA containing protocol-level parameters, including the share-based settlement split and the supermajority threshold.

```rust
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct ProtocolConfig {
    pub authority: Pubkey,
    pub pusd_mint: Pubkey,      // USDC mint; slated to rename to usdc_mint
    pub treasury: Pubkey,
    pub resolver: Pubkey,
    pub assertion_bond_min_pusd: u64,
    pub llm_dispute_bond_ratio_bps: u16,
    pub vote_dispute_bond_ratio_bps: u16,
    pub protocol_fee_bps: u16,
    pub llm_disputer_reward_share_bps: u16,
    pub vote_disputer_reward_share_bps: u16,
    pub voter_reward_share_bps: u16,
    pub treasury_share_bps: u16,
    pub supermajority_bps: u16,
    pub liveness_window_seconds: i64,
    pub llm_challenge_window_seconds: i64,
    pub vote_setup_window_seconds: i64,
    pub voting_window_seconds: i64,
    pub bump: u8,
}
```

- `authority` is governance for the MVP (no separate governance token).
- `resolver` is the only key allowed to post LLM verdicts (`submit_llm_resolution`). It is deliberately separate from `authority`: the resolver is a hot key held by the off-chain service, and a leak exposes only a challengeable verdict, not governance.
- `supermajority_bps` is a **config field** (e.g. `6700` in tests), not a hardcoded constant: it is the weighted threshold a single outcome must reach in a vote, otherwise the outcome is `Unresolvable`.
- The reward-share fields (`llm_disputer_reward_share_bps`, `vote_disputer_reward_share_bps`, `voter_reward_share_bps`, `treasury_share_bps`) divide the slashed pot. Today only `protocol_fee_bps` is applied `[Built]`; the full share-based split is `[MVP-target]`.

### `Treasury` `[Built]`

An SPL token account owned by the protocol authority. Configured in `ProtocolConfig.treasury`.

## Instruction Flow

The instruction names below are stable for this PR.

1. `create_assertion` `[Built]`
   - Stores the statement and the Resolution Spec hash (`auxiliary_hash`).
   - Locks the asserter's USDC bond.
   - Sets `state = ASSERTED`, `outcome = OUTCOME_NONE`, and `liveness_deadline`.

2. `dispute_assertion` `[Built]`
   - Allowed while the assertion is `ASSERTED` and before `liveness_deadline`.
   - Locks the first disputer's USDC bond.
   - Creates `LlmDisputeAccount`.
   - Creates `LlmResolutionRound`.
   - Sets `state = PENDING_LLM`, `dispute_count = 1`, and round/dispute pointers on `AssertionAccount`.

3. `submit_llm_resolution` `[Built]` _(instruction)_ / `[MVP-target]` _(off-chain resolver service)_
   - Gated to `protocol_config.resolver` — a dedicated key, separate from `authority`, so a leaked hot resolver key can only post a challengeable verdict.
   - Accepts only `True`, `False`, or `Unresolvable`; `TooEarly` is rejected per [ADR-0005](adr/0005-no-fault-unresolvable.md).
   - Sets `AssertionAccount.state = ASSERTED_LLM` and opens the LLM challenge deadline.
   - The `[MVP-target]` off-chain trusted resolver makes a single LLM call and posts the verdict through this instruction; on-chain provenance hashing is deferred to `[Vision]`. (The name previously belonged to the removed Switchboard council instruction — [ADR-0002](adr/0002-trusted-llm-resolver.md).)

4. `finalize_llm_resolution` `[Built]`
   - Allowed after the LLM challenge window if no vote dispute exists.
   - Sets `state = RESOLVED` and `outcome = LlmResolutionRound.outcome`.
   - Sets `LlmDisputeAccount.settlement_resolution` and settles bonds (share-based split / no-fault is `[MVP-target]`).

5. `challenge_llm_resolution` `[Built]`
   - Allowed while the assertion is `ASSERTED_LLM` and before the LLM challenge deadline.
   - Locks the second disputer's USDC bond.
   - Creates `VoteDisputeAccount` with `challenged_llm_resolution = LlmResolutionRound.outcome`.
   - Creates `VoteResolutionRound`.
   - Sets `state = PENDING_VOTE`, `dispute_count = 2`, and round/dispute pointers on `AssertionAccount`.

6. `open_vote` `[Built]` (state plumbing) / `[MVP-target]` (real ER delegation)
   - Sets voting deadlines on `VoteResolutionRound`.
   - Moves the assertion from `PENDING_VOTE` to `VOTING`.
   - Sets `delegated = BOOL_TRUE`. In the MVP this delegates the vote state to the MagicBlock ephemeral rollup; auth policy for opening the vote is still to be finalized (currently permissionless for liveness).

7. `finalize_vote_resolution_placeholder` `[Built]` (state plumbing) / `[MVP-target]` (real tally)
   - Allowed after the voting window expires.
   - Sets `VoteResolutionRound.final_outcome` (currently from an argument; in the MVP from the private tally, applying `supermajority_bps` → `Unresolvable` and the MagicBlock commit/undelegate).
   - Sets `AssertionAccount.state = RESOLVED` and `AssertionAccount.outcome`.
   - Sets settlement fields on both dispute accounts and settles bonds.

8. `finalize_undisputed` `[Built]`
   - Allowed after `liveness_deadline` if no dispute exists.
   - Sets `state = RESOLVED` and `outcome = TRUE`.
   - Returns the asserter bond minus configured fees.

9. `initialize_protocol_config` `[Built]`
   - Authority-gated bootstrap of the `ProtocolConfig` singleton.

## State Machine `[Built]`

The six states and their constant values: `Asserted` (0), `PendingLLM` (1), `AssertedLLM` (2), `PendingVote` (3), `Voting` (4), `Resolved` (5).

```text
Asserted(default=True)
  | liveness expires with no dispute
  v
Resolved(True)

Asserted(default=True)
  | first dispute
  v
PendingLLM
  | LLM verdict posted (submit_llm_resolution, resolver-gated)
  v
AssertedLLM(LlmResolutionRound.outcome)
  | LLM challenge window expires
  v
Resolved(LlmResolutionRound.outcome)

AssertedLLM(LlmResolutionRound.outcome)
  | second dispute
  v
PendingVote
  | vote opened
  v
Voting
  | private vote finalized
  v
Resolved(VoteResolutionRound.final_outcome)
```

When a terminal outcome is `Unresolvable`, settlement is no-fault: both bonds returned, nobody slashed, the assertion is voided (re-assert later if it becomes determinable). See [ADR-0005](adr/0005-no-fault-unresolvable.md).

## Integrator Contract

Prediction markets and other consumers should read assertion id, statement, auxiliary hash, state, final outcome, dispute count, dispute pointers, resolution round pointers, and finalized timestamp.

Integrator rules:

- The `auxiliary_hash` points at the off-chain Resolution Spec on Arweave. An integrator **must read the spec** to judge whether an outcome is meaningful for its use case — outcomes are relative to the spec, not to absolute reality.
- In `ASSERTED`, the current non-final answer is the optimistic default `True`.
- In `ASSERTED_LLM`, the current non-final answer is `LlmResolutionRound.outcome`.
- In `PENDING_VOTE` and `VOTING`, the LLM answer is under challenge; final answer is not available until `RESOLVED`.
- Irreversible market settlement should require `state == RESOLVED`.
- Consumers should ignore `AssertionAccount.outcome` unless `state == RESOLVED`.
- An `Unresolvable` outcome means the claim could not be decided under the spec and settled no-fault; an integrator should treat it as "void / no determination," not as `False`.
- Consumers can inspect `dispute_count`, `llm_dispute`, `vote_dispute`, `llm_resolution_round`, and `vote_resolution_round` to understand whether the assertion was disputed once or twice and what each layer produced.
- A later correction requires a new assertion. It must not mutate a resolved assertion.

## External Systems

**LLM resolver** `[MVP-target]`
A single LLM call posted onchain by a trusted off-chain resolver through the resolver-gated `submit_llm_resolution` instruction `[Built]`. This layer does **not** need to be trustless because the staked vote is the trust backstop: a wrong or corrupt verdict is challengeable into the private vote. On-chain provenance hashing is deferred to a `[Vision]` trust-minimized resolver. The former non-mock path — a 3-feed Switchboard council — was removed per [ADR-0002](adr/0002-trusted-llm-resolver.md). Local integration tests call the instruction directly with a test resolver keypair instead of the live resolver service.

**MagicBlock (private ephemeral rollup)** `[MVP-target]`
The final escalation runs as a private, USDC-staked vote inside a MagicBlock ephemeral rollup: votes are sealed during the voting window and only the aggregate outcome is committed onchain, which prevents the bandwagon/beauty-contest collapse a public running tally would cause ([ADR-0003](adr/0003-private-staked-voting.md)). The `VoteResolutionRound` struct carries the MagicBlock fields (validator, permission account, delegated vote state) and the `delegated`/`committed` lifecycle flags for this purpose. This is the MVP's critical-path dependency.

Planned MagicBlock implementation requirements:

- Use dual connections: base layer for initialization/delegation, ER connection for operations on delegated vote state, commits, and undelegation.
- Resolve the devnet ER endpoint and validator together through the MagicBlock router when env overrides are absent.
- Send delegation transactions to the base layer.
- Send vote-cast, reveal/settlement mutations, commit, and undelegate transactions to the ER connection after delegation.
- Use matching PDA seeds between account definitions and delegate calls.
- Check delegation status before accepting ER-side vote mutations.
- Use `skipPreflight: true` for ER transactions where the client stack requires it.
- Wait for state propagation after delegation and undelegation in tests.

## Vision (post-MVP)

These are recorded so the direction is clear; none of them is current behavior. Do not build them yet.

**Trust-minimized / permissionless LLM** `[Vision]`
A future hardening path replaces the trusted resolver with trust-minimized or permissionless inference — Switchboard On-Demand feed(s) or TEE-attested inference; on-chain LLM provenance hashing, if any, would land here. A three-feed Switchboard "council" was once the non-mock resolution path, but was never operationally stood up (tests only ever ran the mock) and was **removed** for the MVP: it bought trust-minimization at a layer already backstopped by the vote, at the cost of operating live feeds. See [ADR-0002](adr/0002-trusted-llm-resolver.md).

**OPAL token & governance** `[Vision]`
A governance/reputation/staking token. Every job once assigned to it — voting weight, voter incentives, governance — is handled in the MVP by staked USDC and the `authority` keypair, so OPAL is deferred. See [ADR-0004](adr/0004-single-asset-usdc.md).

**Proof-of-personhood & sub-linear weighting** `[Vision]`
Proof-of-personhood would enable sub-linear/quadratic vote weighting without Sybil collapse, hardening against the residual 51%-of-stake attack. See [ADR-0003](adr/0003-private-staked-voting.md).

**Stake-duration reputation** `[Vision]`
Long-term staking that accrues voter weight/reputation over time.

**Timed resolution** `[Vision]`
Assertions carry a resolves-at date and cannot finalize before the underlying truth exists; a more principled alternative to prematurity-driven `Unresolvable`. See [ADR-0005](adr/0005-no-fault-unresolvable.md).

**Other considered-and-deferred mechanisms** `[Vision]`
Time-weighted voting (TWAV) — considered and **rejected** (weighting earlier votes empowers a first-moving attacker); recorded so it is not reintroduced. On-chain commit-reveal — the considered alternative to MagicBlock for private voting, rejected for the MVP. Nosana-powered inference — a possible operator-decentralization path for the LLM layer.
