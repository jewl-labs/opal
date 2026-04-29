# Opal Architecture

Opal is a Solana-native optimistic oracle for natural-language statements. The protocol treats every new assertion as true by default during `Asserted`; disputers can challenge that default for direct economic upside, so the protocol design does not require an external monitoring or bot layer.

This document describes the target architecture for the prediction-market wedge. Resolution rules are detailed in [resolution.md](resolution.md), and economics are detailed in [tokenomics.md](tokenomics.md).

## Design Invariants

- `AssertionAccount` does not store a tentative resolution field.
- The current non-final answer is inferred from state: `Asserted` means default `True`; `AssertedLLM` means read `LLMResolutionRound.outcome`; `PendingVote` and `Voting` mean that LLM answer is under challenge and no final answer exists yet.
- `outcome` is unset (`OUTCOME_NONE`) until `state == Resolved`.
- `Asserted` and `AssertedLLM` are liveness states: the current answer can still be challenged.
- `PendingLLM` and `PendingVote` are intermediary states: a dispute has been accepted, but the next resolution layer is not finished or active yet.
- `Resolved` is terminal: `outcome` is set and irreversible consumers can settle.
- The statement lives onchain as a fixed-size byte array (null-terminated string, max 280 bytes).
- Auxiliary data lives offchain as plain text; only `auxiliary_hash` is stored onchain (max 128 bytes).
- Stablecoin is the collateral asset for bonds, slashing, rewards, and fees. Field names currently say `pusd` but the protocol supports any USD-pegged token.
- OPAL is the voting and governance asset (not yet integrated).
- V1 LLM resolution uses a mock instruction gated to protocol authority. Real Switchboard integration is reserved for future work.
- The hardened future resolver may use Nosana-powered inference and/or an LLM Council, but v1 implementation should not require that.
- Final escalation uses MagicBlock private voting with OPAL-weighted TWAV (placeholder — no real voting yet).

## Onchain Account Model

All state accounts are **zero-copy** with `#[repr(C, packed)]`. They contain only primitive types (`u8`, `i64`, `Pubkey`, `[u8; N]`, `u64`, `u16`, `u128`). No `Option<T>`, `bool`, or enums are used inside zero-copy accounts; sentinels (`Pubkey::default()`, `0`, `255`) represent unset fields.

### `AssertionAccount`

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

Implementation notes:

- On creation, `state = ASSERTION_STATE_ASSERTED`, `outcome = OUTCOME_NONE`, and `dispute_count = 0`.
- While `state = ASSERTED`, the current non-final answer is the optimistic default `True`.
- When the first dispute is filed, `dispute_count = 1`, `llm_dispute` is set, `llm_resolution_round` is set, and `state = PENDING_LLM`.
- When the LLM result is posted, `state = ASSERTED_LLM`; the current non-final answer is `LlmResolutionRound.outcome`.
- When the second dispute is filed, `dispute_count = 2`, `vote_dispute` is set, `vote_resolution_round` is set, and `state = PENDING_VOTE`.
- When voting is active, `state = VOTING`; the LLM result remains the challenged result until the vote resolves.
- When finalized, `state = RESOLVED` and `outcome` is set.

### `LlmDisputeAccount`

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

The dispute is correct when `settlement_resolution != OUTCOME_TRUE`. If the LLM result is not challenged, `settlement_resolution` is the LLM result. If the LLM result is challenged, `settlement_resolution` is the final vote result.

### `VoteDisputeAccount`

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

The dispute is correct when `settlement_resolution != challenged_llm_resolution`.

### `BondVault`

A PDA-controlled SPL token account that holds assertion and dispute collateral until settlement. It is initialized alongside the assertion and uses the assertion's PDA as its authority.

### `LlmResolutionRound`

The account tracking LLM resolution for the first dispute. Switchboard fields are reserved but currently default to `Pubkey::default()` / zeros.

```rust
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct LlmResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    pub switchboard_program: Pubkey,    // placeholder
    pub switchboard_queue: Pubkey,      // placeholder
    pub switchboard_feed: Pubkey,       // placeholder
    pub switchboard_feed_hash: [u8; 32],
    pub switchboard_quote: Pubkey,      // placeholder
    pub switchboard_quote_slot: u64,
    pub max_staleness_slots: u64,
    pub prompt_hash: [u8; 32],
    pub variable_overrides_hash: [u8; 32],
    pub response_hash: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub outcome_code: u8,       // 255 = unset
    pub outcome: u8,            // OUTCOME_* (255 = unset)
    pub requested_at: i64,
    pub resolved_at: i64,       // 0 = unset
    pub challenge_deadline: i64, // 0 = unset
    pub bump: u8,
}
```

The Switchboard feed should produce a numeric outcome code. The program maps codes to outcomes: `0 = True`, `1 = False`, `2 = TooEarly`, `3 = Unresolvable`.

### `VoteResolutionRound`

The account tracking private voting for the second dispute. MagicBlock fields are reserved but currently default to `Pubkey::default()` / zeros. No real voting is performed — `finalize_vote_resolution_placeholder` sets a mock outcome.

```rust
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct VoteResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    pub magicblock_validator: Pubkey,   // placeholder
    pub permission_account: Pubkey,     // placeholder
    pub delegated_vote_state: Pubkey,   // placeholder
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

`PendingVote` exists so the protocol can create the vote round and set voting deadlines before moving to `Voting`. In the current placeholder implementation, `open_vote` advances `PendingVote` → `Voting` and sets `delegated = BOOL_TRUE` as a no-op.

### `ProtocolConfig`

Singleton PDA containing protocol-level parameters.

```rust
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct ProtocolConfig {
    pub authority: Pubkey,
    pub pusd_mint: Pubkey,      // will be renamed to usd_mint
    pub treasury: Pubkey,
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

### `Treasury`

An SPL token account owned by the protocol authority. Configured in `ProtocolConfig.treasury`.

## Instruction Flow

1. `create_assertion`
   - Stores the statement and auxiliary data hash.
   - Locks the asserter's stablecoin bond.
   - Sets `state = ASSERTED`, `outcome = OUTCOME_NONE`, and `liveness_deadline`.

2. `dispute_assertion`
   - Allowed while the assertion is `ASSERTED` and before `liveness_deadline`.
   - Locks the first disputer's stablecoin bond.
   - Creates `LlmDisputeAccount`.
   - Creates `LlmResolutionRound`.
   - Sets `state = PENDING_LLM`, `dispute_count = 1`, and round/dispute pointers on `AssertionAccount`.

3. `submit_mock_llm_resolution` _(placeholder)_
   - Gated to `protocol_config.authority`.
   - Maps an outcome code to a resolution outcome.
   - Stores the result on `LlmResolutionRound`.
   - Sets `AssertionAccount.state = ASSERTED_LLM` and opens the LLM challenge deadline.
   - In production, this will be replaced by a Switchboard oracle callback.

4. `finalize_llm_resolution`
   - Allowed after the LLM challenge window if no vote dispute exists.
   - Sets `state = RESOLVED` and `outcome = LlmResolutionRound.outcome`.
   - Sets `LlmDisputeAccount.settlement_resolution`, computes correctness, and settles bonds.

5. `challenge_llm_resolution`
   - Allowed while the assertion is `ASSERTED_LLM` and before the LLM challenge deadline.
   - Locks the second disputer's stablecoin bond.
   - Creates `VoteDisputeAccount` with `challenged_llm_resolution = LlmResolutionRound.outcome`.
   - Creates `VoteResolutionRound`.
   - Sets `state = PENDING_VOTE`, `dispute_count = 2`, and round/dispute pointers on `AssertionAccount`.

6. `open_vote` _(placeholder)_
   - TBD: auth policy is undecided. Currently permissionless for liveness.
   - Sets voting deadlines on `VoteResolutionRound`.
   - Moves the assertion from `PENDING_VOTE` to `VOTING`.
   - Sets `delegated = BOOL_TRUE` as a no-op placeholder for MagicBlock ER delegation.

7. `finalize_vote_resolution_placeholder` _(placeholder)_
   - Allowed after the voting window expires.
   - Takes a mock outcome code as argument.
   - Sets `VoteResolutionRound.final_outcome`.
   - Sets `AssertionAccount.state = RESOLVED` and `AssertionAccount.outcome`.
   - Sets settlement fields on both dispute accounts and settles bonds.
   - In production, this will be replaced by real vote tallying and MagicBlock commit/undelegate.

8. `finalize_undisputed`
   - Allowed after `liveness_deadline` if no dispute exists.
   - Sets `state = RESOLVED` and `outcome = TRUE`.
   - Returns the asserter bond minus configured fees.

## State Machine

```text
Asserted(default=True)
  | liveness expires with no dispute
  v
Resolved(True)

Asserted(default=True)
  | first dispute
  v
PendingLLM
  | LLM result posted
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
  | vote resolution finalized
  v
Resolved(VoteResolutionRound.final_outcome)
```

## Integrator Contract

Prediction markets and other consumers should read assertion id, statement, auxiliary hash, state, final outcome, dispute count, dispute pointers, resolution round pointers, and finalized timestamp.

Integrator rules:

- In `ASSERTED`, the current non-final answer is the optimistic default `True`.
- In `ASSERTED_LLM`, the current non-final answer is `LlmResolutionRound.outcome`.
- In `PENDING_VOTE` and `VOTING`, the LLM answer is under challenge; final answer is not available until `RESOLVED`.
- Irreversible market settlement should require `state == RESOLVED`.
- Consumers should ignore `AssertionAccount.outcome` unless `state == RESOLVED`.
- Consumers can inspect `dispute_count`, `llm_dispute`, `vote_dispute`, `llm_resolution_round`, and `vote_resolution_round` to understand whether the assertion was disputed once or twice and what each layer produced.
- A later correction requires a new assertion. It must not mutate a resolved assertion.

## External Systems

**Switchboard**
V1 uses a mock resolver (`submit_mock_llm_resolution`). Real Switchboard On-Demand/Oracle Quotes integration is reserved for future work. The `LlmResolutionRound` struct already reserves Switchboard fields (program, queue, feed, quote, etc.) for this purpose.

Planned Switchboard implementation requirements:

- Store the expected feed hash and queue on `LlmResolutionRound`.
- Use the mainnet or devnet Switchboard program and queue from protocol config.
- Verify the quote account is canonical for the expected queue/feed hash.
- Reject stale quotes using `max_staleness_slots`.
- Reject values outside the allowed outcome code set.
- If the feed value is scaled, require exact scaled values for the four outcome codes rather than rounding.
- If variable overrides are used to pass assertion-specific data, store `variable_overrides_hash` and require the offchain transcript hash to match. The safer v1 default is an assertion-specific prompt/feed hash so the feed identity commits to the statement and auxiliary data.

**MagicBlock**
MagicBlock Private Ephemeral Rollups will provide the private execution environment for OPAL-weighted voting escalation. The `VoteResolutionRound` struct reserves MagicBlock fields (validator, permission account, delegated vote state) for this purpose. Currently no ER delegation is performed — `open_vote` sets `delegated = BOOL_TRUE` as a no-op.

Planned MagicBlock implementation requirements:

- Use dual connections: base layer for initialization/delegation, ER connection for operations on delegated vote state, commits, and undelegation.
- Resolve the devnet ER endpoint and validator together through the MagicBlock router when env overrides are absent.
- Send delegation transactions to the base layer.
- Send `cast_vote`, reveal/settlement mutations, commit, and undelegate transactions to the ER connection after delegation.
- Use matching PDA seeds between account definitions and delegate calls.
- Check delegation status before accepting ER-side vote mutations.
- Use `skipPreflight: true` for ER transactions where the client stack requires it.
- Wait for state propagation after delegation and undelegation in tests.

**Private Payments API**
The Private Payments API can help build unsigned SPL token transactions for private OPAL deposit, transfer, or withdrawal flows, but Opal should not model vote casting as only a payment. The API is stateless: it builds unsigned transactions and the client signs/submits them to the indicated base or ER endpoint. If used for OPAL, the OPAL mint must be passed explicitly; do not rely on API defaults. Vote casting needs a custom private voting instruction because the protocol must preserve choice, timestamp, locked OPAL, TWAV, reveal/settlement, and slashing semantics.

**Nosana and LLM Council Future Path**
A future hardening path may use Nosana-powered inference or an LLM Council where multiple models or model operators produce independent outputs before aggregation. V1 implementation should not require this.
