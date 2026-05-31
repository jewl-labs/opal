# Opal Oracle Glossary

This glossary is the shared vocabulary for Opal. It gives the project overview and names the terms used throughout the protocol docs. Detailed mechanics live in [architecture.md](architecture.md), [resolution.md](resolution.md), and [tokenomics.md](tokenomics.md).

## Core Protocol

**Opal**
A Solana-native optimistic oracle for verifying real-world statements. Statements are considered true by default unless an economically incentivized disputer challenges them, so the protocol design does not require an external monitoring or bot layer.

**Assertion** - `AssertionAccount`
The onchain object created when an asserter posts a natural-language statement with a stablecoin bond attached.

**Statement** - `statement: [u8; 280]`
The short, human-readable text being asserted. A statement is the sentence whose truth the protocol is asked to resolve. Stored as a null-terminated byte array.

**Auxiliary Data** - `auxiliary_hash: [u8; 128]`
Offchain plain text supplied by the asserter to help resolve the statement. It is stored outside the assertion account, and the assertion stores only its content hash. The protocol does not enforce a schema for this text, but it should ideally include source priority, evidence links, and ambiguity handling. Weak auxiliary data increases the chance of `Unresolvable`.

**Proposed LLM Resolution** - `LlmResolutionRound.outcome`
The non-final result posted by the LLM resolver after the first dispute. It opens the LLM challenge window and becomes final only if no second dispute is filed.

**Final Resolution** - `outcome: u8`
The terminal result on the assertion. It is `OUTCOME_NONE` (255) until `state == Resolved`.

## States And Outcomes

**Assertion State** - raw `u8`
The lifecycle stage of an assertion.

- `Asserted` (0) — initial liveness state; the statement is optimistically treated as `True`, first dispute is allowed, and `outcome = OUTCOME_NONE`.
- `PendingLLM` (1) — first dispute has been filed and the protocol is waiting for the LLM result.
- `AssertedLLM` (2) — the LLM result has been posted on `LlmResolutionRound`, and the LLM challenge window is open.
- `PendingVote` (3) — the LLM result has been challenged and the vote resolution round is being initialized.
- `Voting` (4) — private voting is active or settling. Placeholder: no real votes are cast yet.
- `Resolved` (5) — terminal state; `outcome` is set and integrators can safely settle irreversible positions.

**Resolution Outcome** - raw `u8`
The possible answer values used by LLM and vote resolution rounds, and by the final assertion outcome.

- `True` (0) — the statement is verified as correct.
- `False` (1) — the statement is verified as incorrect.
- `TooEarly` (2) — reserved. Not used in current resolution paths.
- `Unresolvable` (3) — reserved. Not used in current resolution paths.
- `None` (255) — sentinel for unset outcome.

**TooEarly**
A first-class outcome for premature assertions. It is distinct from `False` because the same statement may later become resolvable. Reserved for future use.

**Unresolvable**
A first-class outcome for statements that cannot be safely resolved. It is not a protocol failure. Reserved for future use.

## Participants

**Asserter** - `asserter: Pubkey`
The participant who submits an assertion and locks the assertion bond.

**Disputer**
The participant who challenges the current resolution stage by posting a dispute bond.

**LLM Disputer**
The first disputer. This participant challenges the default optimistic `True` assumption and triggers LLM resolution.

**Vote Disputer**
The second disputer. This participant challenges the proposed LLM resolution and triggers private voting.

**Voter**
An OPAL holder who locks OPAL to participate in the final private voting escalation. Not yet implemented.

**LLM Resolver**
The on-chain path that posts the first-dispute outcome. Production uses `submit_llm_resolution`: three Switchboard pull feeds (the **council**) each publish an integer verdict; the program majority-votes. Local tests use `submit_mock_llm_resolution` (authority-gated, `mock-llm` feature).

**LLM Council**
The three Switchboard feeds configured in `ProtocolConfig.council_feeds` (via `set_council_feeds`) and copied into `LlmResolutionRound` at dispute time. A future hardening path may add more models or off-chain aggregation before feeds update.

**Integrator**
Any protocol or application that consumes Opal outcomes. Integrators can infer the current resolution stage from `AssertionAccount.state` and the linked round accounts, but final settlement should require `state == Resolved`.

## Accounts

**AssertionAccount** - `seeds: [b"assertion", id]`
The primary PDA for an assertion. It stores the statement, auxiliary data hash, current state, final outcome, dispute pointers, resolution round pointers, and finalization metadata. Zero-copy with `#[repr(C, packed)]`.

**LlmDisputeAccount** - `seeds: [b"llm_dispute", assertion_pubkey]`
The first dispute account. It records the disputer, linked `LlmResolutionRound`, settlement resolution, and bond amount. Zero-copy.

**VoteDisputeAccount** - `seeds: [b"vote_dispute", assertion_pubkey]`
The second dispute account. It records the disputer, the LLM resolution it challenged, linked `VoteResolutionRound`, settlement resolution, and bond amount. Zero-copy.

**BondVault** - `seeds: [b"bond_vault", assertion_id]`
A PDA-controlled SPL token account that holds assertion and dispute collateral until settlement. The assertion PDA is its authority.

**LlmResolutionRound** - `seeds: [b"llm_round", assertion_pubkey]`
The account that tracks LLM resolution for the first dispute. Switchboard fields are reserved placeholders. Zero-copy.

**VoteResolutionRound** - `seeds: [b"vote_round", assertion_pubkey]`
The account that tracks private voting for the second dispute. MagicBlock fields are reserved placeholders. Zero-copy.

**ProtocolConfig** - `seeds: [b"protocol_config"]`
Singleton PDA containing tunable protocol parameters: bond minimums and ratios, fee shares, window lengths, `council_feeds`, and authority. Zero-copy.

**Treasury**
The protocol-controlled SPL token account for stablecoin fees and treasury allocations.

## Economics

**Assertion Bond**
Stablecoin collateral posted by the asserter when creating an assertion.

**Dispute Bond**
Stablecoin collateral posted by an LLM disputer or vote disputer.

**OPAL**
The protocol token used for voting weight, governance/config control, and voter participation incentives. Not yet integrated.

**Dispute Correctness**
Whether a dispute was upheld by its settlement layer. The first dispute is correct when settlement resolves to anything other than `True`. The second dispute is correct when the final vote resolution differs from the LLM resolution it challenged.

**Settlement Split**
The configured distribution of slashed collateral and protocol fees between correct disputers, correct voters, and treasury.

**Slashing**
Loss of some or all posted collateral or locked voting stake for being on the wrong side of a finalized dispute, according to protocol parameters.

## Time Windows

**Liveness Window** - `liveness_deadline`
The period during which an `Asserted` statement can receive its first dispute. If no dispute is filed before the deadline, the assertion finalizes as `Resolved(True)`.

**LLM Challenge Window** - `llm_challenge_deadline`
The period after the LLM resolver posts a result during which a vote disputer may challenge that result.

**Vote Setup Window**
The short intermediary period represented by `PendingVote`, during which the vote round is initialized before votes are accepted.

**Voting Window**
The period during which OPAL holders cast private votes. Placeholder: no real voting occurs yet.

**Reveal Phase**
The period after private voting closes, when votes are settled onchain and tallied. Placeholder.

**Time-Weighted Average Vote** - `TWAV`
The rule that a vote's influence is `locked_opal * time_weight`, giving earlier commitments more weight than late commitments. Not yet implemented.

## Resolution Terms

**Switchboard On-Demand Feed**
The planned v1 mechanism for producing the LLM outcome code. The feed should return a numeric code that maps to `True`, `False`, `TooEarly`, or `Unresolvable`, and the program should verify feed identity, queue, freshness, and value before accepting it. Currently a mock resolver is used.

**MagicBlock Private Ephemeral Rollup**
The planned private execution environment for OPAL-weighted voting escalation. Currently a placeholder — no ER delegation is performed.

**Private Payments API**
A MagicBlock API for private SPL token deposit, transfer, and withdrawal transactions. It may help with OPAL custody flows, but Opal vote casting should be a custom private voting instruction rather than only a token transfer. Not yet integrated.

**Supermajority Threshold** - `supermajority_bps = 6700`
The required weighted-vote threshold for a decisive voting outcome. If no outcome reaches the threshold, the assertion resolves `Unresolvable`. Stored in config but not yet enforced.

## Quick Reference

| Concept          | Account / Type              | Notes                                                                        |
| ---------------- | --------------------------- | ---------------------------------------------------------------------------- |
| Assertion        | `AssertionAccount`          | One natural-language statement with collateral                               |
| Statement text   | `statement: [u8; 280]`      | Short onchain text, null-terminated                                          |
| Auxiliary data   | `auxiliary_hash: [u8; 128]` | Offchain text hash                                                           |
| Lifecycle        | raw `u8`                    | `Asserted`, `PendingLLM`, `AssertedLLM`, `PendingVote`, `Voting`, `Resolved` |
| Final answer     | `outcome: u8`               | Set only in `Resolved` (255 = unset)                                         |
| First dispute    | `LlmDisputeAccount`         | Challenges default optimistic `True`                                         |
| Second dispute   | `VoteDisputeAccount`        | Challenges LLM resolution                                                    |
| First resolution | `LlmResolutionRound`        | Switchboard council (`submit_llm_resolution`; mock in local tests)           |
| Final escalation | `VoteResolutionRound`       | Placeholder (MagicBlock in future)                                           |
| Collateral asset | Stablecoin                  | Bonds, slashing, rewards, treasury. Field names say `pusd`.                  |
| Voting asset     | OPAL                        | Voting weight and governance (not yet integrated)                            |
