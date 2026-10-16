# Opal Glossary

Opal is a Solana optimistic oracle for natural-language statements. An asserter posts a Statement, a USDC bond, and a Resolution Spec; the Statement is `True` by default unless disputed. A first dispute goes to a trusted LLM resolver, and a challenge of that verdict escalates to a private staked vote. Rules and numbers live in [protocol.md](protocol.md); the code as built lives in [architecture.md](architecture.md).

## Core

**Assertion** — `AssertionAccount`
The on-chain record created when an asserter posts a Statement, a Participant Bond, and a Resolution Spec URI. It carries the lifecycle `state` and the final `outcome`.

**Assertion ID** — `AssertionAccount.id`
The canonical public reference for an Assertion: the public key of a one-time, client-generated keypair that signs creation. It grants no authority afterward.
_Avoid_: the Assertion PDA or the statement text as an identifier

**Statement** — `statement`
The short human-readable sentence whose truth is asserted. Its structural limits are in [protocol.md](protocol.md).

**Resolution Spec**
The asserter-supplied, immutable JSON rubric that says how the Statement is judged: ordered authoritative sources, conflict and unavailability behavior, definitions, and ambiguity handling. It is the source of truth; the resolver and voters apply it. Format: [resolution-spec-v1.schema.json](schemas/resolution-spec-v1.schema.json).
_Avoid_: auxiliary data, evidence, hint

**Resolution Spec URI** — `resolution_spec_uri` (the program field is still `auxiliary_hash`)
The `ar://` identifier of the Resolution Spec's permanent Arweave upload, stored on the Assertion.

**Source Hierarchy**
The Resolution Spec's ordered list of authoritative sources, with its rules for conflict and source unavailability.

**Rubric-relative truth**
Opal's stance: "True" means true under this Assertion's Resolution Spec, not a universal fact, so one Statement can resolve differently under different specs. See [ADR-0001](adr/0001-rubric-relative-truth.md).
_Avoid_: absolute truth, ground truth

**Bond Vault** — the `bond_vault` PDA token account
The USDC token account, controlled by the Assertion PDA, that holds Participant Bonds until settlement or vote escalation.

**Protocol Config** — `ProtocolConfig`
The singleton account of deployment-wide settings: USDC mint, Treasury, Devnet Admin Authority, resolver key, and parameters ([protocol.md](protocol.md#parameters)).

## Lifecycle and outcomes

**Assertion State** — `state` (`ASSERTION_STATE_*`)

- `Asserted` — default `True`; first dispute allowed.
- `PendingLLM` — first dispute filed; awaiting the resolver's verdict.
- `AssertedLLM` — verdict posted; open to challenge.
- `PendingVote` — verdict challenged; vote readiness not yet projected to Solana.
- `Voting` — the vote is projected as active or settling.
- `Resolved` — terminal; `outcome` is set.
- `ResolverUnavailable` — terminal; `outcome` stays unset.

**Resolution Outcome** — `outcome`
The truth result of a `Resolved` Assertion: `True` (0), `False` (1), `NoConsensus` (2), `Unresolvable` (3). `OUTCOME_NONE` (255) means unset.

**Unresolvable**
An affirmative finding that the Statement cannot be decided under its Resolution Spec. It is fault-assigned: the asserter is the incorrect party.
_Avoid_: no-fault Unresolvable, indeterminate

**NoConsensus**
A vote-only outcome: the Vote Quorum is not met, or no option reaches the Supermajority, including a Vote Round with no Votes. It is the only no-fault outcome: nothing is slashed and no rewards are paid.
_Avoid_: TooEarly

**ResolverUnavailable**
A terminal status, not an outcome: the resolver did not post a verdict by the Resolver Deadline, so no truth judgment occurred. Settlement is in [protocol.md](protocol.md).
_Avoid_: listing it beside the four outcomes; mapping it to `Unresolvable` or `NoConsensus`

**LLM Dispute** — `LlmDisputeAccount`
The first dispute: a Disputer posts a Participant Bond to challenge the default `True`, which triggers LLM resolution.

**LLM Resolution Round** — `LlmResolutionRound`
The record of one resolver verdict: its request time, result, and challenge deadline.

**Vote Dispute** — `VoteDisputeAccount`
The second dispute: a Disputer posts a Participant Bond to challenge the LLM verdict, which escalates to a Vote Round.

**Assertion Dispute Window** — `liveness_deadline`
The period after creation in which the default `True` can be disputed.
_Avoid_: liveness window

**LLM Dispute Window** — `llm_challenge_deadline`
The period after the resolver's verdict in which it can be challenged.
_Avoid_: LLM challenge window, LLM liveness window

**Voting Window**
The period in which Votes can be cast. The Voting PER holds its authoritative clock.

**Resolver Deadline**
The protocol deadline, counted from the first accepted dispute, by which the resolver must post its verdict. It is not a participant-facing window.

**Permissionless Finalization**
After a deadline passes, anyone may submit the deterministic transaction that finalizes the Assertion (`finalize_undisputed`, `finalize_llm_resolution`). Nothing finalizes by the clock alone, and the caller cannot choose the result or redirect payouts.

## Participants

**Asserter** — `asserter`
The wallet that posts an Assertion and its bond.

**Disputer** — `LlmDisputeAccount.disputer`, `VoteDisputeAccount.disputer`
A wallet that posts a Participant Bond to challenge the current answer. The **LLM Disputer** is first and challenges the default `True`; the **Vote Disputer** is second and challenges the LLM verdict.

**Bonded Participant**
The Asserter, LLM Disputer, or Vote Disputer: a wallet holding a Participant Bond in one Assertion.

**Voter**
A wallet that places a Vote in a Vote Round.

**LLM Resolver** — `ProtocolConfig.resolver`
The trusted off-chain service that applies the Resolution Spec to its sources and posts a `True`, `False`, or `Unresolvable` verdict through `submit_llm_resolution`, which only the `resolver` key may call. See [ADR-0002](adr/0002-trusted-llm-resolver.md).
_Avoid_: council

**Devnet Admin Authority** — `ProtocolConfig.authority`
The single Opal-team wallet that is program upgrade authority and owner of the Treasury token account on Devnet. The resolver key is separate and role-limited. See [protocol.md](protocol.md).

**Integrator**
Any app that consumes Opal outcomes. It reads the Resolution Spec to judge whether an outcome fits its use, consumes a truth outcome only from a `Resolved` Assertion read at `finalized` commitment, and handles `ResolverUnavailable` only through an explicit non-truth policy.

## Economics

**USDC** — `usdc_mint`
The single protocol asset for bonds, stake, rewards, and fees. `ProtocolConfig.usdc_mint` is set at initialization so localnet and Devnet can use a test mint.
_Avoid_: pusd, any stablecoin, OPAL

**Participant Bond** — `bond_amount_usdc`
The equal USDC collateral each Bonded Participant posts. Amount: [protocol.md](protocol.md#parameters).

**Bond Fee**
The non-refundable fee withheld from each Participant Bond at normal settlement.

**Voting Fee**
The non-refundable fee withheld from Vote stake at settlement, after tallying.

**Treasury** — `ProtocolConfig.treasury`
The public USDC token account that receives Bond Fees, Voting Fees, and indivisible rounding dust.

**Slashing**
Loss of bond or stake for being on the wrong side of a finalized dispute or vote. Slashed value funds the winners.

## Vote stage

The private staked vote that resolves a challenged LLM verdict. Mechanics for every term in this group, and the feasibility gate on the whole stage, are in [vote-stage.md](vote-stage.md).

**Vote Round** — `VoteRound`
The per-dispute staked vote that produces the final outcome when an LLM verdict is challenged.

**Vote**
One wallet's immutable, USDC-staked choice among `True`, `False`, and `Unresolvable` in one Vote Round, cast privately and weighted linearly by stake. Losing-side stake funds winners: a Schelling-point game ([ADR-0003](adr/0003-private-staked-voting.md)).

**Gross Voting Stake**
The USDC a Vote locks, before the Voting Fee. It supplies the Vote's weight.

**Vote Quorum**
The minimum participation required before the Supermajority is evaluated; failing it yields `NoConsensus`.

**Supermajority**
The weighted share one option must reach, once quorum is met, to win the Vote Round.

**Private Voting Balance**
A reusable, wallet-scoped USDC balance funded through MagicBlock's private-payment flow, from which Vote stake is locked inside the Voting PER.
_Avoid_: anonymous deposit, Opal wallet

**Voting PER**
The MagicBlock Private Ephemeral Rollup validator that hosts every Vote Round and Private Voting Balance in a deployment.

**Vote Initialization**
The retryable, idempotent cross-runtime transition after a Vote Dispute that moves the Assertion's bonds into the Vote Settlement Vault and starts the Voting Window. It is not a participant-facing window.
_Avoid_: vote setup window

**Vote Settlement Vault**
The round-scoped logical balance on the Voting PER that holds every Participant Bond and Vote stake for the round. Actual USDC sits in eSPL's shared global vault.
_Avoid_: a separate physical vault; confusion with the Bond Vault or the Slashed Pool

**Slashed Pool**
At vote-stage settlement, the collateral of incorrect bonds and losing stake that remains after fees.

**Reward Weight**
A correct position's original capital at risk: a correct Participant Bond or a winning Vote's Gross Voting Stake. The Slashed Pool is paid out pro rata by it.

**Public Vote Position** — `VotePositionAccount`
The permanent public record, per wallet and Vote Round, of a Vote's outcome, stake, exact payout, and status: `Claimable`, `Claimed`, or `Slashed`. Positions are published in bounded batches after finalization; `PositionPublicationComplete` marks the set done.

**Vote-stage Payout Claim**
The wallet-authorized action that moves a finalized vote-stage payout from the Vote Settlement Vault into the wallet's Private Voting Balance. Withdrawal to a public account is a separate action.

## Not in the MVP

- **OPAL token** — governance, reputation, or voter incentives; USDC and the Devnet Admin Authority replace it.
- **Trustless resolver** — trust-minimized or TEE-attested inference in place of the trusted LLM Resolver.
- **Proof-of-personhood** — wallet counts never identify people.
- **Timed resolution** — a protocol-level field that prevents premature resolution; a Resolution Spec cannot carry a cutoff date.
- **Source-change invalidation** — voiding a non-final Assertion because authoritative information changed.
- **TWAV (time-weighted voting)** — rejected; do not build it.
