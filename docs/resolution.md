# Opal Resolution

Resolution is the process that turns the optimistic default answer into a final answer. An assertion starts in `Asserted`, where the statement is treated as `True` by default; disputes move the assertion through LLM resolution and, if necessary, private OPAL voting.

## Assertion Requirements

Every assertion includes:

1. An onchain `statement`: a short natural-language sentence (max 280 bytes, null-terminated).
2. An onchain `auxiliary_hash`: the content hash of offchain plain text that helps resolvers and voters interpret the statement (max 128 bytes).

The protocol does not enforce a schema for the auxiliary data behind `auxiliary_hash`. It should ideally include source priority, evidence links, and ambiguity handling. If the auxiliary data is vague, missing, or contradictory, the statement is more likely to resolve `Unresolvable`.

## Outcome Rules

**`True`**
The available evidence verifies the statement.

**`False`**
The available evidence contradicts the statement.

**`TooEarly`**
The real-world truth needed to resolve the statement does not exist yet or has not been published at resolution time. Reserved for future use — not currently produced by any resolution path.

**`Unresolvable`**
The statement cannot be safely resolved. Use this when source priority is unclear, evidence conflicts, evidence is unavailable, the statement is ambiguous, auxiliary data is too weak, or voting fails to reach the configured supermajority threshold. Reserved for future use — not currently produced by any resolution path.

## Current Answer By State

`AssertionAccount` does not store a tentative resolution field. The current non-final answer is inferred from state and linked round accounts:

- `Asserted` (0): current non-final answer is the optimistic default `True`.
- `PendingLLM` (1): the default `True` has been disputed and no LLM answer has been posted yet.
- `AssertedLLM` (2): current non-final answer is `LlmResolutionRound.outcome`.
- `PendingVote` (3): the LLM answer has been challenged and vote setup is in progress.
- `Voting` (4): final answer is pending vote settlement.
- `Resolved` (5): final answer is `AssertionAccount.outcome`.

## Lifecycle

### 1. Asserted

When an assertion is created:

- the asserter posts a stablecoin assertion bond
- `state = Asserted`
- `outcome = None` (255)
- `liveness_deadline` is set
- `auxiliary_hash` points to offchain auxiliary data

While `Asserted`, the statement is treated as `True` by default. The liveness window is the only time a first dispute can be filed.

### 2. PendingLLM

When the first dispute is filed:

- `ProtocolConfig.council_feeds` must already be set (`set_council_feeds`)
- the LLM disputer posts a stablecoin dispute bond
- `LlmDisputeAccount` is created
- `LlmResolutionRound` is created (council feed pubkeys copied from config)
- `state = PendingLLM`
- `dispute_count = 1`

The assertion waits for the LLM resolver to post an outcome. On-chain, `submit_llm_resolution` reads the three council feeds and majority-votes. Integration tests on localnet use `submit_mock_llm_resolution` (authority-gated, `mock-llm` build) instead.

### 3. AssertedLLM

When the LLM result is posted:

- `LlmResolutionRound.outcome` is set
- `state = AssertedLLM`
- the LLM challenge deadline opens

The current non-final answer is now the LLM result. If no second dispute is filed before the challenge deadline, the assertion can be finalized with the LLM outcome.

### 4. PendingVote

When the LLM result is challenged:

- the vote disputer posts a stablecoin dispute bond
- `VoteDisputeAccount` is created with `challenged_llm_resolution`
- `VoteResolutionRound` is created
- `state = PendingVote`
- `dispute_count = 2`

The assertion waits for voting to open.

### 5. Voting

When `open_vote` is called:

- voting deadlines are set on `VoteResolutionRound`
- `state = Voting`

In the current placeholder implementation, `open_vote` is permissionless and sets `delegated = BOOL_TRUE` without performing actual MagicBlock ER delegation.

### 6. Resolved

When a resolution path finalizes:

- `state = Resolved`
- `outcome` is set
- `finalized_at` is set
- dispute settlement fields are populated
- bond redistribution occurs

Three paths lead to `Resolved`:

1. **Undisputed:** `finalize_undisputed` sets `outcome = True`.
2. **LLM resolution:** `finalize_llm_resolution` sets `outcome = LlmResolutionRound.outcome`.
3. **Vote resolution:** `finalize_vote_resolution_placeholder` sets `outcome` from a mock argument (placeholder for real vote tallying).

## Settlement Logic

### Undisputed

If the liveness window expires with no dispute:

- assertion resolves `True`
- asserter bond is returned minus protocol fee
- treasury receives the fee

### First Dispute (LLM Resolution)

If `finalize_llm_resolution` is called (no vote dispute exists):

- the LLM outcome becomes the final outcome
- if the LLM disputer was correct (`outcome != True`):
  - LLM disputer wins: receives their bond + assertion bond minus fee
  - treasury receives fee
- if the LLM disputer was incorrect (`outcome == True`):
  - asserter wins: receives their bond + LLM disputer bond minus fee
  - treasury receives fee

### Second Dispute (Vote Resolution)

If `finalize_vote_resolution_placeholder` is called:

- the mock outcome becomes the final outcome
- if the LLM disputer was correct (`outcome != True`):
  - LLM disputer receives their bond + assertion bond minus fee
- if the LLM disputer was incorrect:
  - asserter receives assertion bond + LLM disputer bond minus fee
- if the vote disputer was correct (`outcome != challenged_llm_resolution`):
  - vote disputer receives their bond back (no positive incentive yet)
- if the vote disputer was incorrect:
  - vote disputer bond is slashed (transferred to winner or treasury)
- treasury receives fees from both stages

> **Note:** Vote disputer rewards and voter rewards are not yet implemented. `vote_disputer_reward_share_bps` and `voter_reward_share_bps` exist in `ProtocolConfig` but are not distributed.
