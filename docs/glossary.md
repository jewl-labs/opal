# Opal Oracle Glossary

This glossary is the shared vocabulary for Opal. It gives the project overview
and names the terms used throughout the protocol docs. Detailed mechanics live
in [architecture.md](architecture.md), [resolution.md](resolution.md), and
[tokenomics.md](tokenomics.md).

## Core Protocol

**Opal**
A Solana-native optimistic oracle for verifying real-world assertions written as
natural language statements. Assertions are considered true by default unless an
economically incentivized disputer challenges them, so the protocol design does
not require an external monitoring or bot layer.

**Assertion** - `AssertionAccount`
The core unit of the protocol: a natural-language statement posted onchain by an
asserter with a USDC bond attached.

**Statement** - `statement: String`
The short, human-readable statement stored directly on the assertion account.

**Auxiliary Data** - `auxiliary_hash: String`
The offchain criteria bundle used to resolve the assertion. It should define the
source priority, event deadline, evidence rules, and ambiguity policy. The
content is stored on IPFS or Arweave, with its content hash stored onchain.

**Optimistic Truth**
The default assumption that an assertion is true while it is in the liveness
window. Optimistic truth is not final truth: consumers should treat it as
tentative until the assertion reaches `Resolved`.

**Final Truth**
The terminal protocol output written only after an assertion reaches `Resolved`
and has a concrete `ResolutionOutcome`.

## States And Outcomes

**Assertion State** - `AssertionState`
The lifecycle stage of an assertion.

- `Asserted` - submitted, optimistically true, liveness window open, challengeable, non-terminal, and `outcome = None`.
- `PendingLLM` - first dispute filed; the v1 LLM resolver is producing or has produced an initial verdict.
- `AssertedLLM` - LLM verdict has been declared, and same conditions as `Asserted`.
- `PendingVote` - the LLM result was challenged. 
- `Voting` - OPAL-weighted private voting is active or awaiting settlement.
- `Resolved` - terminal state; `outcome` is set and integrators can safely settle irreversible positions.

**Resolution Outcome** - `ResolutionOutcome`
The terminal verdict on a resolved assertion.

- `True` - the criteria confirm the statement.
- `False` - the criteria contradict the statement.
- `TooEarly` - the required ground truth does not exist yet or has not been published by the source deadline.
- `Unresolvable` - the criteria or evidence are insufficient, contradictory, genuinely ambiguous, or voting fails to reach the required supermajority.

**TooEarly**
A first-class outcome for premature assertions. It is distinct from `False`
because the statement may later become resolvable once the real-world event or
official source exists.

**Unresolvable**
A first-class outcome for statements that cannot be safely resolved under the
provided criteria. It is not a protocol failure.

## Participants

**Asserter** - `asserter: Pubkey`
The participant who submits an assertion and locks the assertion bond.

**Disputer** - `disputer: Pubkey`
The participant who challenges an assertion or an LLM result by posting a dispute
bond. Disputers have direct financial upside from catching incorrect assertions.

**Voter**
An OPAL holder who locks OPAL to participate in the final private voting
escalation.

**LLM Resolver**
The v1 resolution service for disputed assertions. It uses a Switchboard custom
feed to call a configured single-LLM API and post the resulting verdict.

**LLM Council**
A future hardening path where multiple models or model operators produce
independent outputs before aggregation.

**Integrator**
Any protocol or application that consumes Opal outcomes. Integrators may display
`Asserted` statements as tentative optimistic truth, but final settlement should
require `state == Resolved`.

## Accounts

**AssertionAccount** - `seeds: [b"assertion", id]`
The primary PDA for an assertion. It stores the statement, auxiliary data hash,
asserter, bond vault, current state, liveness deadline, optional outcome, and
finalization metadata.

**DisputeAccount** - `seeds: [b"dispute", assertion_pubkey, dispute_index]`
The PDA created for each dispute event. It stores the disputer, bond amount,
timestamp, dispute index, and challenged phase.

**BondVault**
A PDA-controlled USDC token account that holds assertion and dispute collateral
until settlement.

**ResolutionRound** - `seeds: [b"round", assertion_pubkey]`
The account that tracks disputed resolution: LLM resolver output, challenge
window, voting metadata, aggregate result, and final outcome.

**VoteRecord** - `seeds: [b"vote", assertion_pubkey, voter_pubkey]`
The per-voter record for an escalated assertion. It tracks locked OPAL, private
vote commitment or reveal metadata, vote timing, and settlement status.

**ProtocolConfig**
The account containing tunable protocol parameters such as bond ratios, fee
shares, windows, and the supermajority threshold.

**Treasury**
The protocol-controlled destination for configured USDC fees and treasury shares.

## Economics

**Assertion Bond**
USDC collateral posted by the asserter when creating an assertion.

**Dispute Bond**
USDC collateral posted by a disputer when challenging an assertion or LLM result.

**OPAL**
The protocol token used for voting weight, governance/config control, and voter
participation incentives.

**Settlement Split**
The configured distribution of slashed collateral and protocol fees between the
winning side, correct voters, and treasury.

**Slashing**
Loss of some or all posted collateral or locked voting stake for being on the
wrong side of a finalized dispute, according to protocol parameters.

**Economic Symmetry**
The design principle that asserters and disputers both post meaningful collateral
so incorrect assertions and frivolous disputes are both costly.

## Time Windows

**Liveness Window** - `liveness_deadline`
The period during which an `Asserted` statement is challengeable. If no dispute is
filed before the deadline, the assertion finalizes as `Resolved(True)`.

**LLM Challenge Window**
The period after the v1 LLM resolver posts a result during which a disputer may
challenge that result and escalate to voting.

**Voting Window**
The period during which OPAL holders cast private votes in the MagicBlock voting
environment.

**Reveal Phase**
The period after private voting closes, when votes are settled onchain and
tallied.

**Time-Weighted Average Vote** - `TWAV`
The rule that a vote's influence is `locked_opal * time_weight`, giving earlier
commitments more weight than late commitments.

## Resolution Terms

**Switchboard Custom Feed**
The v1 mechanism for calling the configured LLM API and posting resolver output
back to the protocol.

**MagicBlock Ephemeral Rollup**
The private voting environment used for the OPAL-weighted escalation layer.

**Supermajority Threshold** - `supermajority_bps = 6700`
The required weighted-vote threshold for a decisive voting outcome. If no outcome
reaches the threshold, the assertion resolves `Unresolvable`.

**Schelling Point**
The answer honest participants are expected to converge on because it reflects
external reality under the assertion's criteria.

## Quick Reference

| Concept | Account / Type | Notes |
| --- | --- | --- |
| Assertion | `AssertionAccount` | One natural-language assertion |
| Statement text | `statement: String` | Short onchain statement |
| Resolution criteria | `auxiliary_hash: String` | IPFS or Arweave content hash |
| Lifecycle | `AssertionState` | `Asserted`, `PendingLLM`, `Voting`, `Resolved` |
| Final verdict | `ResolutionOutcome` | `True`, `False`, `TooEarly`, `Unresolvable` |
| Challenge | `DisputeAccount` | One per dispute event |
| Disputed resolution | `ResolutionRound` | LLM and voting metadata |
| Individual vote | `VoteRecord` | One per voter per assertion |
| Collateral asset | USDC | Bonds, slashing, rewards, treasury |
| Voting asset | OPAL | Voting weight and governance |
