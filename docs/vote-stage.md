# Vote Stage

> **Gated. Nothing here is built.** Implementation starts only after the PER/eSPL spike passes the [acceptance criteria](#spike-acceptance-criteria). If it fails, the [proposed mechanism](#proposed-mechanism) is replaced (commit-reveal, or sealed per-voter records with a disclosed trusted relay or attested aggregator) and the [product rules](#product-rules) stand.

**Code today.** `challenge_llm_resolution` locks the third bond in a `VoteDisputeAccount` and leaves the Assertion in `PendingVote`; nothing moves it further.

Numbers: [protocol.md](protocol.md#parameters). Terms: [glossary.md](glossary.md). Why private, linear, slashed and dual-quorum: [ADR-0003](adr/0003-private-staked-voting.md).

## Product rules

These hold for any mechanism.

| Rule                     | Detail                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Private while open       | Choices, stakes, balances and per-outcome totals stay hidden until the window closes. Positions go public after finalization: privacy, not anonymity.                                                                                                                                                                                                                                                              |
| Linear weight            | Weight is Gross Voting Stake, the original stake before fees. No curve, no per-wallet cap; the minimum Vote is in [protocol.md](protocol.md#parameters).                                                                                                                                                                                                                                                           |
| Quorum and supermajority | Stake and distinct-wallet quorums must both pass ([values](protocol.md#parameters)); every voting wallet counts once, bonded wallets included. A winner (`True`, `False` or `Unresolvable`) then needs the inclusive Supermajority.                                                                                                                                                                                |
| `NoConsensus`            | Failed quorum (zero votes included) or no option at the supermajority. Fault and fees: [protocol.md](protocol.md).                                                                                                                                                                                                                                                                                                 |
| One immutable Vote       | One per wallet per round, so a wallet may vote in several rounds if its unlocked balance covers each stake. No change, top-up or withdrawal. The first accepted submission wins; later ones fail without locking stake or a fee. After an already-voted error, read the existing position.                                                                                                                         |
| Deadline                 | Counts only if recorded on the Voting PER with `execution_time < voting_deadline`.                                                                                                                                                                                                                                                                                                                                 |
| Bonded wallets vote      | The Asserter, LLM Disputer and Vote Disputer may each Vote any outcome; bond and Vote settle independently.                                                                                                                                                                                                                                                                                                        |
| Fees after the tally     | The Voting Fee is computed per Vote and taken at settlement, never before the tally.                                                                                                                                                                                                                                                                                                                               |
| Slashing and rewards     | Incorrect bonds and losing stake, after fees, form the Slashed Pool. Reward Weight is the bond amount for a correct bond, `gross_stake_atomic` for a winning Vote. `reward = floor(slashed_pool × weight ÷ total_weight)`, checked `u128`, range-checked `u64`. No Opal share. After the last claim, a residual below the rewarded-position count is treasury dust; a larger one is `RecoveryNeeded`, never swept. |
| Claimed, not pushed      | Voters are unbounded, so nothing pays everyone. Finalization freezes each entitlement; the owner claims it into their own Private Voting Balance only, unlocked at once. A positive payout is `Claimable` immediately, never expires or accrues; a fully slashed position is terminal `Slashed`. Wallet-bound; no admin recovery.                                                                                  |
| Public positions         | After finalization each Vote gets a permanent public `VotePositionAccount` (owner, outcome, stake, payout, status `Claimable`, `Claimed` or `Slashed`). `Resolved` does not wait for `PositionPublicationComplete`; voter enumerators must.                                                                                                                                                                        |
| No sponsorship           | No Opal fee on deposits, claims, withdrawals or publication; no caller reward. Each party pays its own costs.                                                                                                                                                                                                                                                                                                      |

## Proposed mechanism

MagicBlock Private Ephemeral Rollup (PER) plus eSPL. Only `publish_vote_ready` and `claim_vote_payout` are fixed names; seeds, sizes and eSPL interfaces freeze after the spike.

- **One Voting PER.** `ProtocolConfig.voting_per_validator` is fixed at deployment and copied into each round; clients find the endpoint through the MagicBlock router. A PER transaction touches only co-located accounts.
- **Never delegated:** `AssertionAccount`, dispute accounts, `ProtocolConfig`, the Bond Vault, the treasury account, `VoteRound`, registered `VotePositionAccount`s.
- **Bridge accounts** are fixed-size PDAs created and funded on Solana, delegated, written by the PER, then committed and undelegated for a Solana instruction to consume. Never a rollup-only Ephemeral Account or an event; raw private positions are never undelegated.
- **Nothing is atomic across runtimes.** Setup nonces, monotonic phases and exact-match idempotency join them: a retry is a no-op, a conflict fails before moving funds.
- eSPL's global vault on Solana holds all private USDC. `ephemeral-rollups-sdk` is not a dependency today; pin the version the spike proves.

### Accounts

| Account                                          | Role                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `VoteDisputeAccount`                             | Gains setup nonce, mint, validator, setup payer and reserve accounting.                                                |
| `VoteSetupPayer`                                 | Zero-data System-owned PDA holding the capped reserve (`vote_setup_reserve_lamports`); Opal signs via `invoke_signed`. |
| `VoteRound`                                      | Public projection: window, aggregates, counts, publication progress, outcome, bonded payout statuses.                  |
| Vote Settlement Vault (PER)                      | Round-scoped delegated eATA record holding all bonds and stakes.                                                       |
| `VotePrivateState` (PER)                         | Shared tally, settlement inputs, counters.                                                                             |
| `PrivateVotePosition` (PER)                      | Per voter: outcome, stake, Voting Fee, claimed marker. Authoritative.                                                  |
| `TreasuryStagingBalance` (PER)                   | Round-scoped PDA-controlled fee and dust balance.                                                                      |
| `VoteReadyReceipt`, `AggregateSettlementReceipt` | Bridges for the Voting Window and the final aggregates.                                                                |
| `VotePositionAccount`                            | Bridge, then permanent; the voter creates, funds and delegates it blank before casting.                                |
| `ClaimReceipt`                                   | Bridge; the claimant creates, funds and delegates it; the claim writes it.                                             |
| `TreasuryFeeDelivery`, `TreasuryDustDelivery`    | Bridges: fixed destination, own nonce, one-way `Pending` to `Completed` or `RecoveryNeeded`.                           |

`VoteSetupPayer` funds round state and receipts, never a caller's fees.

### Instructions

"Once proven": the spike shows an Opal PDA can supply the needed authority; until then the step needs a named signer.

| Instruction (runtime, caller)                      | Effect                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `challenge_llm_resolution` (Solana, Vote Disputer) | Extended: locks the third bond, funds `VoteSetupPayer`, creates `VoteRound`; all-or-nothing. |
| Setup phases (anyone once proven)                  | Deposit bonds, credit the vault, delegate, start the session.                                |
| `publish_vote_ready` (Solana, anyone)              | Copies the restored window; `PendingVote` to `Voting`.                                       |
| `cast_vote` (PER, voter)                           | Locks stake, writes the position.                                                            |
| `finalize_vote` (PER, anyone once proven)          | Tallies, freezes results, stages fees.                                                       |
| `resolve_vote` (Solana, anyone)                    | Validates the restored receipt; sets `Resolved`.                                             |
| `claim_vote_payout` (PER, owner)                   | Pays one position.                                                                           |
| `publish_positions` (anyone once proven)           | Writes, then registers, `VotePositionAccount`s in bounded batches.                           |
| `sync_claim_status` (Solana, anyone once proven)   | Moves a public status to `Claimed`.                                                          |
| `deliver_treasury_fees`, `deliver_treasury_dust`   | Send a staged tranche to the treasury; anyone once proven.                                   |

### Vote Initialization

- Too little bond or reserve rejects the dispute. There is no setup window, timeout or abort; completed phases stay retryable, and none can move funds twice, change the validator or redirect the refund.
- The window starts on the PER only after bonds and private state are verified on one router-resolved endpoint. Votes are valid there while Solana still shows `PendingVote`, so clients check authenticated PER state; a late `publish_vote_ready` never creates or resets it.
- Rent returns to `VoteSetupPayer`, and a reconciled refund sends surplus to the setup payer. The treasury never pays; anyone may top up a short reserve.

### Private Voting Balance

- A reusable canonical eATA per wallet on the Voting PER, created, funded and delegated by its owner before casting ([minimum deposit](protocol.md#parameters)). Stake is pre-funded because a public transfer at cast time reveals wallet and amount.
- The hosted Private Payments API builds deposits and withdrawals. Casting and claiming use a pinned on-chain eSPL integration (SPL CPI or `ephemeral-spl-api`; the spike chooses) so token movement is atomic with Opal state.
- Only unlocked balance funds a Vote or a withdrawal of any positive amount. Deposits and withdrawals report `Pending`, `Completed` or `RecoveryNeeded`; only destination confirmation gives `Completed`.
- Only the wallet closes its balance, at zero amount and locks; outstanding claims survive.
- A bonded non-voter needs no balance until it claims; it then directly initializes and delegates an empty destination, paying SOL setup only.

### Casting and finalization

- A setup with no accepted Vote closes and refunds its payer; acceptance makes `VotePositionAccount` permanent. The blank base-layer account may reveal intent to vote, not outcome or stake.
- Each floored Voting Fee is computed at cast time and totalled exactly; gross aggregates cannot reproduce the sum of floors.
- Finalization freezes the outcome, per-outcome stake and position counts, total positions, fee totals, the Slashed Pool, Reward Weight inputs and `unclaimed_positive_position_count`, derived from counts without enumerating wallets. Only the aggregate receipt is committed.
- Claims open at PER finalization, possibly before Solana shows `Resolved`, which waits for public aggregates.

### Claims

`claim_vote_payout(round, position, recipient_private_balance)`:

- Needs the owner's signature and a positive unclaimed `Claimable` position of a finalized round. The amount comes from frozen totals and the position's bond or stake; the destination must be the owner's existing canonical balance, never created or substituted.
- One PER transaction transfers from the vault, decrements the unclaimed count, sets the PER-resident claimed marker and writes the `ClaimReceipt`. The marker, not public status, blocks double payment; a failed claim changes nothing.
- A direct same-PER transfer, not the delayed transfer queue, which drops its item before the result is known. A wallet with a bond and a Vote has two claims; a client may bundle them.

### Publication, treasury and cleanup

- Any order: the PER writes each `VotePositionAccount`, and Solana registers the restored record after validating it against finalized state. Callers cannot choose contents or double-count; completion is set when registered equals the frozen count.
- Status only moves forward. Registration writes `Claimed` only with the matching restored `ClaimReceipt`, else stale `Claimable` until `sync_claim_status`. Public status never authorizes payment. Publication and sync never expire.
- Finalization stages all Bond Fees and the Voting Fee total for `TreasuryFeeDelivery`. At zero unclaimed positions, reconciling vault balance against claimed totals yields dust for `TreasuryDustDelivery`. Only public confirmation completes a delivery, which never reopens the outcome.
- The vault record closes only at zero balance, locks, unclaimed count and unstaged fees or dust; a settled flag is not enough. A pending delivery blocks closing staging and its record, not the vault. Each closable account refunds rent to its creation payer; eligibility and destination are never caller-controlled.

## Spike acceptance criteria

All must pass.

- [ ] **Write without read:** an arbitrary voter submits a Vote and locks stake without read access to the tally, vault balance, other positions or sensitive transaction metadata. MagicBlock currently couples permission with read access.
- [ ] **Unbounded voters:** member lists, account sizes and transaction limits support any voter count.
- [ ] **Atomic lock and ballot:** one PER transaction locks stake and records one immutable ballot; failed or duplicate submissions lock nothing.
- [ ] **PDA-controlled eSPL custody:** Opal PDAs control bonds and settlement balance; reusable balance locking works; the eSPL interface is chosen.
- [ ] **Zero-deposit destination:** an owner can directly create and delegate an empty canonical eATA to receive a claim.
- [ ] **Receipt cycle:** base-created receipts and position accounts delegate, are written in the PER and are restored by commit-and-undelegate.
- [ ] **Setup payer:** a PDA-signed low-level MagicBlock CPI records `VoteSetupPayer` as rent payer; otherwise the setup design changes before launch, with no hidden signer fallback.
- [ ] **PDA authority:** every "once proven" step above works under an Opal PDA.
- [ ] **TEE measurement:** the client verifies an application-approved measurement, not merely a valid TDX quote.
- [ ] **eSPL infrastructure:** does hosted MagicBlock provision the validator-scoped eSPL mint, transfer queue, global vault and rent PDAs? If not, the deployment operator pays once, outside treasury and participant reserves.

## Accepted risks

- **Setup outage:** bonds stay in `PendingVote` until setup resumes; the MVP has no abort. Post-MVP: an invalidation resolving a stalled `PendingVote` as `NoConsensus`, every bond claimable minus ordinary fees.
- **Single Voting PER:** one availability, operator, funding and upgrade domain for all balances and rounds; no migration or fallback.
- **Claims depend on the PER:** claims never expire, so the vault stays delegated while any payout is unclaimed and an outage freezes it. No base-layer fallback, admin migration or forfeiture.
- **Public traces:** deposits and withdrawals are public and can leak timing or amount correlations.
- **Residual attacks:** a 51%-of-stake attack, mitigated by bond and reward sizing.

## Open questions

Order: adversary, spike, eSPL model, account matrix, lifecycle.

- **Privacy adversary:** hidden from public RPC users, voters, the Opal admin, the MagicBlock operator, the TEE program? An upgradeable program cannot hide from its own admin; TEE measurement and upgrade policy are undecided.
- **Placement and commit matrix:** per account, base-only, delegated or ER-only; what commits together; what stays delegated for claims; authority checks per transition; how a PER result authorizes the Assertion update.
- **Failure recovery:** each cross-runtime step needs an operation ID, retry actor, deadline, fallback and fee budget; partial deposit, delegation, commit, withdrawal, publication and treasury failures are unspecified.
- **PER operations:** validator and TEE rotation, outage handling, migration, monitoring. MagicBlock sponsors ten commits by default unless the app supplies a delegated payer and fee vault, so a long-lived PER needs a top-up policy.
- **Security budget:** bonds and quorum do not bound the value an Assertion secures, and a low-turnout challenge forces the no-fault path while voters still pay fees; needs an exposure cap, an observer assumption, and evidence that rewards cover voters' cost of capital at small scale.
