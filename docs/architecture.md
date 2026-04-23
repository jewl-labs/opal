# Opal Architecture

Opal is a Solana-native optimistic oracle for natural-language assertions. The
protocol assumes an assertion is true during its liveness window, but it is not
final until the assertion reaches `Resolved`. Incorrect assertions are challenged
by disputers who have direct economic upside, so the protocol does not require an
external monitoring or bot layer.

This document describes the target architecture for the prediction-market wedge.
Resolution rules are detailed in [resolution.md](resolution.md), and economics
are detailed in [tokenomics.md](tokenomics.md).

## Design Invariants

- `Asserted` is non-terminal: the assertion is optimistically true,
  challengeable, and has `outcome = None`.
- `Resolved` is terminal: `outcome` is set and irreversible consumers can settle.
- The short statement lives onchain; detailed resolution criteria live offchain
  on IPFS or Arweave with a content hash onchain.
- USDC is the collateral asset for bonds, slashing, rewards, and fees.
- OPAL is the voting and governance asset.
- V1 LLM resolution uses a Switchboard custom feed that calls one configured LLM
  API.
- The hardened future resolver may use Nosana-powered inference and/or an LLM
  Council, but v1 implementation should not require that.
- Final escalation uses MagicBlock private voting with OPAL-weighted TWAV.

## Onchain Account Model

### `AssertionAccount`

The primary PDA for a claim.

```rust
pub struct AssertionAccount {
    pub id: Pubkey,
    pub asserter: Pubkey,
    pub statement: String,
    pub auxiliary_hash: String,
    pub bond_vault: Pubkey,
    pub state: AssertionState,
    pub liveness_deadline: i64,
    pub outcome: Option<ResolutionOutcome>,
    pub finalized_at: Option<i64>,
    pub resolution_round: Option<Pubkey>,
    pub bump: u8,
}
```

Implementation notes:

- `outcome` stays `None` in `Asserted`, `PendingLLM`, and `Voting`.
- `outcome` is set only when `state` becomes `Resolved`.
- `auxiliary_hash` points to the canonical criteria bundle used by resolvers and
  voters.

### `DisputeAccount`

The PDA created for each challenge event.

```rust
pub struct DisputeAccount {
    pub assertion: Pubkey,
    pub disputer: Pubkey,
    pub dispute_index: u8,
    pub challenged_phase: ChallengedPhase,
    pub bond_amount_usdc: u64,
    pub created_at: i64,
    pub settled: bool,
    pub bump: u8,
}
```

`dispute_index = 0` represents the first dispute against the assertion.
`dispute_index = 1` represents the challenge against the LLM result.

### `BondVault`

A PDA-controlled USDC token account holding assertion and dispute collateral until
settlement.

The vault should be linked from the assertion and should only release funds
through protocol settlement instructions.

### `ResolutionRound`

The account tracking the disputed resolution path.

```rust
pub struct ResolutionRound {
    pub assertion: Pubkey,
    pub llm_outcome: Option<ResolutionOutcome>,
    pub llm_evidence_hash: Option<String>,
    pub llm_resolved_at: Option<i64>,
    pub llm_challenge_deadline: Option<i64>,
    pub voting_deadline: Option<i64>,
    pub reveal_deadline: Option<i64>,
    pub aggregate_votes: Option<VotesPerOutcome>,
    pub final_outcome: Option<ResolutionOutcome>,
    pub bump: u8,
}
```

The v1 `llm_outcome` is produced through Switchboard. Future versions can add
per-model outputs or council aggregation without changing the consumer finality
contract.

### `VoteRecord`

The per-voter account for an escalated assertion.

```rust
pub struct VoteRecord {
    pub assertion: Pubkey,
    pub voter: Pubkey,
    pub locked_opal: u64,
    pub commitment: [u8; 32],
    pub choice: Option<ResolutionOutcome>,
    pub voted_at: i64,
    pub revealed_at: Option<i64>,
    pub settled: bool,
    pub bump: u8,
}
```

Votes are private during the active voting window. The revealed `choice` is
populated only during settlement/reveal.

### `ProtocolConfig`

The account containing protocol-level parameters:

- bond minimums and ratios
- protocol fee shares
- voter reward and slashing shares
- liveness, LLM challenge, voting, and reveal windows
- Switchboard feed authority/config
- MagicBlock voting config
- treasury address
- governance authority

### `Treasury`

The protocol-controlled destination for configured fees and treasury allocations.

## Instruction Flow

1. `create_assertion`
   - Stores the statement and auxiliary hash.
   - Locks the asserter's USDC bond.
   - Sets `state = Asserted`, `outcome = None`, and `liveness_deadline`.

2. `dispute_assertion`
   - Allowed while the assertion is `Asserted` and before `liveness_deadline`.
   - Locks the first disputer's USDC bond.
   - Creates `DisputeAccount` with `dispute_index = 0`.
   - Creates or links `ResolutionRound`.
   - Sets `state = PendingLLM`.

3. `submit_llm_result`
   - Called by the configured Switchboard result path.
   - Stores the v1 LLM outcome, evidence hash/reference, timestamp, and challenge
     deadline on `ResolutionRound`.
   - Keeps `AssertionAccount.outcome = None` until the challenge window closes.

4. `challenge_llm_result`
   - Allowed during the LLM challenge window.
   - Locks the second disputer's USDC escalation bond.
   - Creates `DisputeAccount` with `dispute_index = 1`.
   - Opens MagicBlock private voting.
   - Sets `state = Voting`.

5. `finalize_llm_result`
   - Allowed after the LLM challenge window if no second dispute exists.
   - Sets `state = Resolved`, copies the LLM outcome into
     `AssertionAccount.outcome`, and settles bonds.

6. `cast_vote`
   - Used during `Voting`.
   - Locks OPAL and records a private vote commitment through the MagicBlock flow.

7. `reveal_or_settle_vote`
   - Used after the voting window.
   - Reveals or settles private votes, computes TWAV influence, and updates
     aggregate totals.

8. `finalize_vote`
   - Resolves the assertion from aggregate weighted votes.
   - Sets `state = Resolved`, sets `outcome`, and settles USDC/OPAL rewards and
     slashing.

9. `finalize_undisputed`
   - Allowed after `liveness_deadline` if no dispute exists.
   - Sets `state = Resolved` and `outcome = Some(True)`.
   - Returns the asserter bond minus any configured fees.

## State Machine

```text
Asserted
  | liveness expires with no dispute
  v
Resolved(True)

Asserted
  | first dispute
  v
PendingLLM
  | Switchboard LLM result unchallenged through challenge window
  v
Resolved(True | False | TooEarly | Unresolvable)

PendingLLM
  | LLM result challenged
  v
Voting
  | MagicBlock private TWAV finalized
  v
Resolved(True | False | TooEarly | Unresolvable)
```

State semantics:

- `Asserted`: optimistic truth, liveness open, no terminal outcome.
- `PendingLLM`: disputed, awaiting v1 LLM resolver output or the LLM challenge
  window.
- `Voting`: LLM output challenged, private OPAL vote is active or settling.
- `Resolved`: final and immutable for integrators.

## Integrator Contract

Prediction markets and other consumers should read:

- assertion id
- statement
- auxiliary hash
- state
- outcome
- finalized timestamp
- protocol/config version if available

Integrator rules:

- `Asserted` can be displayed or used as tentative optimistic truth.
- Irreversible market settlement should require `state == Resolved`.
- Consumers should ignore `outcome` unless `state == Resolved`.
- Consumers should retain the auxiliary hash with any market so users can audit
  the criteria used for resolution.
- A later correction requires a new assertion. It must not mutate a resolved
  assertion.

## External Systems

**Switchboard**
V1 uses a Switchboard custom feed to call one configured LLM API and submit the
resulting outcome/evidence reference to the resolution round.

**MagicBlock**
MagicBlock ephemeral rollups provide the private voting environment for the
OPAL-weighted escalation layer.

**IPFS or Arweave**
Auxiliary data and evidence references are stored offchain. The onchain account
stores the content hash that makes the criteria auditable.

**Nosana and LLM Council Future Path**
Future resolver hardening may move model inference to Nosana and/or query an LLM
Council. That path should preserve the same consumer-facing finality:
integrators still read only resolved assertions.
