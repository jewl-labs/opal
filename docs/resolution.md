# Opal Resolution

Resolution is the process that turns an assertion from optimistic truth into
final truth. An assertion starts in `Asserted`, where it is treated as true by
default but remains challengeable and non-terminal. Only `Resolved` assertions
have final outcomes.

## Assertion Requirements

Every assertion must include two pieces:

1. An onchain `statement`
   - A short natural-language claim.
   - Example: `Team A defeated Team B in the April 23, 2026 final.`

2. An auxiliary criteria bundle
   - Stored on IPFS or Arweave.
   - Referenced onchain by `auxiliary_hash`.
   - Used as the source of truth by the LLM resolver and voters.

The auxiliary criteria bundle should ideally specify:

- source priority: which official or trusted sources control the answer
- evidence rules: which documents, APIs, articles, or public records are valid
- ambiguity policy: how to handle conflicting, missing, or partial evidence

If criteria are missing or contradictory, resolution should bias toward
`Unresolvable` rather than inventing unstated rules.

## Outcome Rules

**`True`**
The criteria confirm the statement.

**`False`**
The criteria contradict the statement.

**`TooEarly`**
The required ground truth does not yet exist or has not been published by the
event/source deadline. This is the correct outcome for premature assertions, not
for statements that are merely hard to research.

**`Unresolvable`**
The statement cannot be safely resolved under the provided criteria. Use this when:

- source priority is missing or contradictory
- valid sources conflict and the criteria do not say how to break the tie
- required evidence is unavailable after the relevant deadline
- the statement is too ambiguous to map onto the criteria
- voting fails to reach the configured supermajority threshold

## Resolution Lifecycle

### 1. Asserted

When an assertion is created:

- the asserter posts a USDC assertion bond
- `state = Asserted`
- `outcome = None`
- `liveness_deadline` is set
- the assertion is optimistically true but not final

If the liveness window expires with no dispute, the assertion resolves
`True` without LLM review or voting.

### 2. First Dispute

A disputer may challenge an `Asserted` statement before the liveness deadline by
posting a USDC dispute bond.

The first dispute:

- creates a `DisputeAccount`
- creates or links a `ResolutionRound`
- moves the assertion to `PendingLLM`
- triggers the v1 LLM resolver path

The economic reason this does not need an external monitoring layer is that a
correct disputer can win collateral by challenging incorrect assertions.

### 3. V1 LLM Resolver

V1 uses a Switchboard custom feed to call one configured LLM API.

The LLM resolver must evaluate:

- the onchain statement
- the auxiliary criteria bundle
- evidence allowed by the criteria

The resolver output should include:

- `outcome`
- evidence/source summary
- evidence hash or reference
- resolver timestamp
- Switchboard feed identity or authority reference

The resolver should not resolve from unstated assumptions. If the statement
cannot be mapped to the criteria, the correct output is `Unresolvable`.

After the resolver output is posted, an LLM challenge window opens. During this
window, the assertion remains non-terminal and `outcome` remains `None`.

### 4. LLM Result Unchallenged

If no second dispute is filed before the LLM challenge deadline:

- the assertion becomes `Resolved`
- `AssertionAccount.outcome` is set to the LLM resolver outcome
- bonds are settled according to `tokenomics.md`
- integrators may settle irreversible positions

### 5. Second Dispute And Voting Escalation

If a participant challenges the LLM result during the challenge window, they post
the second USDC dispute bond and the assertion moves to `Voting`.

The second dispute:

- challenges the LLM result, not the original assertion directly
- opens the MagicBlock private voting flow
- makes OPAL holders the final escalation layer

### 6. Private OPAL Voting

During the voting window:

- voters lock OPAL
- votes are cast privately through MagicBlock
- live vote direction is hidden
- votes receive time-weighted influence

Canonical influence:

```text
vote_influence = locked_opal * time_weight
```

`time_weight` should be highest at the start of the voting window and decrease
toward the deadline. The exact curve is a protocol parameter, but it must be
deterministic and auditable.

### 7. Reveal And Tally

After voting closes:

- private votes are revealed or settled
- weighted votes are aggregated per outcome

A decisive outcome requires:

```text
winning_outcome_weight >= 67% of total valid weighted votes
```

The protocol parameter is:

```text
supermajority_bps = 6700
```

If no outcome reaches the threshold, the assertion resolves `Unresolvable`.

## Finality

Finalized outcomes are immutable for integrators.

Once `state == Resolved`:

- `outcome` must be set
- settlement can occur
- consumers should treat the result as final
- later corrections require a new assertion

The protocol should support linking related or corrective assertions, but it
should not mutate the outcome of a resolved assertion.

## V1 And Future Resolver Path

V1 resolver:

- Switchboard custom feed
- single configured LLM API
- one posted resolver outcome

Future hardening:

- Nosana-powered custom inference
- multiple model outputs
- LLM Council aggregation
- richer evidence attestations

Future resolver changes should preserve the same state machine and integrator
contract.
