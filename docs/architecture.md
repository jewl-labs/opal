# Architecture

What the program does today, and what is left to build. The target rules are in [protocol.md](protocol.md); terms are in [glossary.md](glossary.md).

## Status

| Capability                                                 | Status   | Notes                                                                                                            |
| ---------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| Create assertion, bond vault, undisputed finalization      | Built    | The bond is any amount at or above `assertion_bond_min_usdc`, not the fixed Participant Bond.                    |
| First dispute, resolver verdict, LLM finalization          | Built    | The dispute bond is a ratio of the assertion bond. The fee comes only from the losing bond, not from every bond. |
| Challenge to `PendingVote`                                 | Built    | Locks the third bond. Nothing moves the Assertion further until the vote stage exists.                           |
| Push settlement (`settlement.rs`)                          | Built    | All pre-vote payouts go through it.                                                                              |
| Gate `initialize_protocol_config` on the upgrade authority | To build | Today anyone can initialize the config, and it cannot be changed afterwards.                                     |
| Resolver Deadline and `ResolverUnavailable`                | To build | Today a silent resolver locks both bonds in `PendingLLM` indefinitely.                                           |
| Resolver key rotation                                      | To build | `update_resolver`, authority-only, emitting an event. The program emits no events yet.                           |
| Fixed Participant Bond, Bond Fee on every bond             | To build | Replaces the two bond-ratio fields, `assertion_bond_min_usdc` and `protocol_fee_bps`.                            |
| Bonded role separation                                     | To build | Three distinct wallets per Assertion.                                                                            |
| Signed Assertion ID                                        | To build | `assertion_id` becomes a signer.                                                                                 |
| Statement validation                                       | To build | Only the 280-byte maximum is checked today.                                                                      |
| `resolution_spec_uri: [u8; 48]`                            | To build | Replaces `auxiliary_hash: [u8; 128]`, which only checks a maximum length.                                        |
| Outcome code 2 as `NoConsensus`                            | To build | The constant is still named `OUTCOME_TOO_EARLY`. The resolver already cannot post code 2.                        |
| Off-chain resolver service                                 | To build | Lives in [jewl-labs/opal-resolver](https://github.com/jewl-labs/opal-resolver), not here.                        |
| Vote stage                                                 | Gated    | [vote-stage.md](vote-stage.md). Waits on the MagicBlock feasibility spike.                                       |

Nothing is officially deployed, so account layouts can still change freely. The off-chain resolver reads `ProtocolConfig`, so coordinate layout changes with it.

## Accounts

All program accounts are zero-copy (`#[account(zero_copy(unsafe))]` with `#[repr(C, packed)]`) and use primitive fields with sentinels (see [AGENTS.md](../AGENTS.md)).

| Account                | Seeds                          | Holds                                                                                                                                |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ProtocolConfig`       | `["protocol_config"]`          | authority, `usdc_mint`, treasury token account, resolver key, bond minimum, two bond ratios, fee bps, liveness and challenge windows |
| `AssertionAccount`     | `["assertion", assertion_id]`  | id, asserter, statement, `auxiliary_hash`, state, deadlines, outcome, bond, links to its dispute and round accounts                  |
| Bond vault (SPL token) | `["bond_vault", assertion_id]` | every bond for the Assertion; its authority is the Assertion PDA                                                                     |
| `LlmDisputeAccount`    | `["llm_dispute", assertion]`   | disputer, bond, `settlement_resolution` (blocks double settlement)                                                                   |
| `LlmResolutionRound`   | `["llm_round", assertion]`     | verdict, request and resolve times, challenge deadline                                                                               |
| `VoteDisputeAccount`   | `["vote_dispute", assertion]`  | disputer, bond, the challenged verdict                                                                                               |

Dispute and round accounts are seeded by the Assertion key, so Anchor's seeds constraint already ties them to their Assertion; handlers don't re-check the stored links. Nothing is ever closed.

## Instructions

| Instruction                  | Caller            | Requires                                                                 | Effect                                                                         |
| ---------------------------- | ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `initialize_protocol_config` | anyone (see gaps) | sane bps and windows, resolver not default                               | creates the singleton config                                                   |
| `create_assertion`           | asserter          | statement ≤ 280 bytes, hash ≤ 128 bytes, bond ≥ minimum, configured mint | creates the Assertion and vault, deposits the bond, sets the liveness deadline |
| `dispute_assertion`          | any wallet        | `Asserted`, before the liveness deadline                                 | deposits the ratio bond, creates the dispute and round, `PendingLLM`           |
| `submit_llm_resolution`      | resolver key      | `PendingLLM`, outcome 0, 1 or 3                                          | records the verdict, sets the challenge deadline, `AssertedLLM`                |
| `challenge_llm_resolution`   | any wallet        | `AssertedLLM`, before the challenge deadline                             | deposits the ratio bond, creates the vote dispute, `PendingVote`               |
| `finalize_undisputed`        | anyone            | `Asserted`, no dispute, at or after the liveness deadline                | settles `Undisputed`, `Resolved` with `True`                                   |
| `finalize_llm_resolution`    | anyone            | `AssertedLLM`, at or after the challenge deadline                        | settles `LlmVerdict`, `Resolved` with the verdict                              |

States in code: `Asserted` 0, `PendingLLM` 1, `AssertedLLM` 2, `PendingVote` 3, `Resolved` 5. Value 4 is reserved for the vote stage's `Voting`.

## Settlement

`programs/opal/src/settlement.rs` is the only code that moves funds out of a bond vault. Handlers do their state and deadline checks, then make one call:

```rust
settle(Settlement::LlmVerdict { outcome }, &positions, fee_bps, treasury, accounts, signer_seeds)?;
```

`settle` checks the recipient token-account owners, the treasury key and vault coverage before moving anything, then transfers each non-zero leg signed by the Assertion PDA. The private `plan` function computes the payouts, and its unit tests pin the numbers and check that payouts always sum to the bonds. When the fee and bond rules change, the change goes in `plan` and its test table. The vote stage does not extend this module: its payouts are claims ([vote-stage.md](vote-stage.md)).

## Testing

- `cargo test -p opal`: pure unit tests, currently the settlement planner. Put new pure logic (validators, lifecycle rules) behind a function that is tested here.
- `anchor test`: `tests/opal.test.ts` on surfpool. Deadlines are crossed with surfpool's `surfnet_timeTravel` cheatcode, not sleeps. Negative tests assert the exact error name. Seeds, states and outcomes are read from the IDL (`#[constant]` in `constants.rs`).
- CI (`.github/workflows/ci.yml`) runs prettier, `cargo fmt --check` and `cargo test` in one job, and `anchor build` plus `anchor test` in another.

## Known gaps

- **Config initialization is unauthenticated.** On a fresh deployment the first caller sets the authority, treasury and resolver permanently. The fix is a ProgramData upgrade-authority check, not the program-ID comparison once sketched in a comment (the program account cannot pay for `init`).
- **No resolver timeout.** See the status table.
- **A second `dispute_assertion` fails in Anchor's `init`** ("already in use") before the handler's `AssertionAlreadyDisputed` guard runs.
- **`anchor build` warns about a program-ID mismatch** when `target/deploy/opal-keypair.json` differs from `declare_id!`. It does not affect tests.
