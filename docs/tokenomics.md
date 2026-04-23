# Opal Tokenomics

Opal uses two assets with separate jobs:

- USDC is the collateral asset for assertion bonds, dispute bonds, slashing,
  rewards, and treasury fees.
- OPAL is the protocol token for voting weight, governance/config control, and
  voter participation incentives.

This separation keeps dispute collateral stable while still giving OPAL holders
responsibility for final subjective resolution.

## Assets

### USDC

USDC is used for:

- assertion bonds
- first dispute bonds
- second dispute/escalation bonds
- slashed collateral
- voter reward payouts
- protocol treasury fees

Using USDC makes assertion and dispute costs easier for integrators and market
creators to reason about.

### OPAL

OPAL is used for:

- private voting weight
- governance over protocol parameters
- possible future staking or reputation layers
- voter participation incentives

During voting escalation, OPAL is locked and counted with time-weighted
influence.

## Bond Model

### Assertion Bond

The asserter posts a USDC bond when creating an assertion.

Purpose:

- makes false assertions costly
- funds rewards when a dispute is upheld
- gives disputers direct upside for finding incorrect claims

### First Dispute Bond

The first disputer posts a USDC bond to challenge an `Asserted` claim.

Purpose:

- prevents free griefing
- creates economic symmetry between asserter and disputer
- funds rewards if the dispute fails

The default policy is a matching or configured-ratio bond against the assertion
bond.

### Second Dispute Bond

The second disputer posts a USDC escalation bond to challenge the LLM result and
open OPAL voting.

Purpose:

- prevents frivolous escalation
- compensates the protocol and correct participants for the cost of final voting
- makes the LLM challenge step economically meaningful

## Settlement Defaults

### Undisputed Assertion

If the liveness window expires with no dispute:

- assertion resolves `True`
- asserter bond is returned
- configured protocol fees may be collected

### Disputed Assertion Resolves `True`

If a disputed assertion resolves `True`:

- asserter wins
- disputer bond is slashed or reallocated according to config
- asserter bond is returned
- correct voters, if any, may receive configured rewards
- treasury receives configured fees/share

### Disputed Assertion Resolves `False`

If a disputed assertion resolves `False`:

- disputer wins
- asserter bond is slashed or reallocated according to config
- disputer bond is returned with configured reward share
- correct voters, if any, may receive configured rewards
- treasury receives configured fees/share

### Assertion Resolves `TooEarly`

If an assertion resolves `TooEarly`:

- principal bonds should be returned by default
- protocol fees may be collected
- no party should be treated as lying solely because ground truth was premature
- a new assertion may be submitted once ground truth exists

If the auxiliary criteria clearly warned that the assertion was premature, a
future config may apply a bad-action penalty to the asserter.

### Assertion Resolves `Unresolvable`

If an assertion resolves `Unresolvable`:

- principal bonds should be returned by default
- protocol fees may be collected
- no truth-side winner is selected
- voter rewards should be limited or skipped unless the implementation defines a
  specific reward rule for ambiguity

This conservative default avoids over-penalizing good-faith participants when
the criteria or evidence are genuinely insufficient.

## Voter Rewards And Slashing

Voting is the final escalation layer, so voters take on protocol responsibility.

Correct voters:

- recover locked OPAL
- may receive a share of slashed USDC collateral
- may receive additional configured OPAL incentives if governance enables them

Incorrect voters:

- recover or lose OPAL according to `incorrect_vote_slash_bps`
- do not receive winning-side USDC rewards

Unrevealed or invalid votes:

- should be excluded from valid weighted totals
- may be penalized by governance-configured parameters

The exact slashing implementation must be deterministic and visible before a
voter commits OPAL.

## Time-Weighted Voting

Canonical vote influence:

```text
vote_influence = locked_opal * time_weight
```

Design intent:

- reduce deadline sniping
- reward earlier commitment
- make coordinated late manipulation more expensive

The exact `time_weight` curve belongs in protocol config or implementation docs,
but it must be deterministic, monotonic over the voting window, and auditable.

## Protocol Parameters

The following names should be used consistently in code and docs:

| Parameter | Purpose |
| --- | --- |
| `assertion_bond_min_usdc` | Minimum USDC bond for a new assertion |
| `dispute_bond_ratio` | First dispute bond relative to assertion bond |
| `second_dispute_bond_ratio` | Escalation bond relative to assertion bond or first dispute bond |
| `protocol_fee_bps` | Protocol fee applied during settlement |
| `voter_reward_share_bps` | Share of slashed USDC allocated to correct voters |
| `treasury_share_bps` | Share of slashed USDC allocated to treasury |
| `incorrect_vote_slash_bps` | OPAL slash rate for incorrect voters |
| `supermajority_bps` | Required weighted-vote threshold; default `6700` |
| `liveness_window_seconds` | Time an assertion remains challengeable before undisputed finalization |
| `llm_challenge_window_seconds` | Time to challenge the v1 LLM resolver output |
| `voting_window_seconds` | Time OPAL holders have to cast private votes |

Governance may tune these values, but integrators should be able to identify the
active config used by any assertion.

## Risk Notes

**Low-value claim griefing**
Bond minimums should be high enough that spam and frivolous disputes are
uneconomic.

**Value-at-risk mismatch**
Prediction markets may secure more value than the assertion bond. Integrators
should choose or require bond tiers appropriate to market value.

**Whale capture**
OPAL-weighted voting can be captured by concentrated holders. TWAV, private
voting, quorum requirements, and governance distribution all matter.

**V1 resolver centralization**
Switchboard single-LLM resolution is a practical v1 path, not the final trust
model. Nosana inference and/or an LLM Council are future hardening paths.

**Ambiguous criteria**
Poor auxiliary criteria increase `Unresolvable` outcomes. Market creators should
write criteria that make source priority and deadlines explicit.
