# TODO

What we've discussed and considered so far. This is not a fixed plan. "Direction" items are where the discussion landed; "Open" items are still being thought through. When something lands, update the docs and remove it here.

## How we're working

- The program lags far behind the docs. First update the docs once so they describe the target, then bring the program up to them, one item per PR.
- `docs/architecture.md`'s status table is the tracker. A rule that isn't built gets a "To build" row; when no rows are left, the docs and code match and the table can go.

## Direction

### Bonds and windows

- One fixed Participant Bond, equal for the Asserter, LLM Disputer and Vote Disputer (1× at every stage). Simpler for an MVP than letting each asserter pick, and it removes the "bond too big to match" problem.
- Keep it a `ProtocolConfig` field set at initialization, not a hardcoded constant, so Mainnet can use a different value.
- Keep 7-day windows until there are enough watchers to catch bad assertions faster. (UMA/Polymarket use 2 hours.)
- Code today lets the asserter choose any bond above a minimum, with dispute bonds as ratios. Replace that.

### Integrator as asserter

- Whoever consumes the result creates the assertion and writes the spec. No asserter reward is needed. Asserting stays open to anyone.
- Conflict of interest isn't treated as a problem: an operator who lies loses users, disputers can always correct it, and the spec is fixed when the market is created.
- The asserter will often be a program (a PDA, via CPI). Split `payer` from `asserter` in `create_assertion`; today the asserter pays rent.

### Resolution Spec URI

- Store the raw 32-byte Arweave ID (`[u8; 32]`) instead of the `ar://` string. Clients display it as `ar://` + base64url.
- Why: smaller (32 vs 48 bytes), no text validation on-chain, and one spelling per ID. 43 base64url characters hold 258 bits for a 256-bit ID, so up to four strings decode to the same ID.
- The program rejects only all-zero bytes. Whether the spec exists and is valid stays the resolver's job.
- Replaces `auxiliary_hash: [u8; 128]` in code and the planned `[u8; 48]` in the docs.

### Statement

- Printable ASCII only: bytes `0x20`–`0x7E`, 1–280 bytes, case preserved.
- Blocks every Unicode spoofing trick with a one-line byte check. Byte count equals character count.
- Drops the Unicode table, the TypeScript client rules and the conformance vectors from `protocol.md`.
- Costs accents and non-English text. Widening later is backward compatible; narrowing isn't.

### Assertion ID

- The Assertion ID is the assertion PDA, derived from `["assertion", asserter, nonce]`, with `nonce` a client-chosen random `u64` stored on the account.
- Nobody can front-run it, since only the asserter can sign for it. Removes the extra Assertion ID signer and the `assertion_id` argument.
- The bond vault becomes `["bond_vault", assertion]`. Later instructions take the assertion account directly.
- The glossary's "avoid the PDA as an identifier" flips.

### Role separation: dropped

- Any wallet may hold any role, including several roles in one assertion. A fresh wallet takes seconds, so the rule stops nobody, and it blocks natural behaviour (the LLM-verdict loser is the obvious challenger; an asserter may want to dispute their own claim after new information).
- The code has no role check today, so this is mostly a docs change: the lifecycle table and "Role separation" bullet in `protocol.md`, the "Bonded role separation" row in `architecture.md`.
- Consideration, `dup`: Anchor rejects a transaction that lists the same writable account twice, unless that field is marked `dup`, because it could otherwise save two stale copies of one account. If one wallet is asserter and disputer and has one USDC account, `finalize_llm_resolution` must list that account twice (asserter payout and disputer payout) and fails with `ConstraintDuplicateMutableAccount`. The same happens in both finalize instructions if the treasury owner ever asserts.
  - Likely fix: `#[account(mut, dup)]` on the payout token accounts (`asserter_usdc`, `llm_disputer_usdc`, `treasury_usdc`).
  - Why it looks safe: Anchor only writes back accounts Opal owns, and token accounts belong to the Token program. `settle` reads only the vault balance before transferring, and two transfers into one account add up.
  - Found by reading Anchor 1.1.2's source, not tested. Write the failing test first (one wallet asserts and disputes, then finalize with a single token account).
- For the vote stage: payouts are keyed by role, so one wallet can hold up to three bonds plus a vote.

### Config admin

- Gate `initialize_protocol_config` on the program's upgrade authority (ProgramData check). PR #31 has code worth salvaging for this and for `update_resolver`.
- Add a two-step authority transfer (propose, then accept) and authority-only `update_resolver`, emitting events.
- Bonds and fees stay fixed per deployment for now. If they ever become changeable, snapshot them onto each assertion, because `settle` reads the live config.
- Key policy:
  - During development: a single key.
  - Before outside integrators use Devnet: a Squads v4 vault as upgrade authority, `ProtocolConfig.authority` and treasury owner. Same audited program ID on Devnet and Mainnet.
  - Mainnet: Squads with a timelock.
  - The resolver stays a separate hot key.
- `protocol.md`'s "Devnet authority and treasury" section says the opposite ("No multisig") and needs rewriting.

### Resolver service

- Unbuilt. It will be built from scratch in [jewl-labs/opal-resolver](https://github.com/jewl-labs/opal-resolver); any current code there is thrown out.
- `docs/architecture.md` and `AGENTS.md` both point at that repo as if the service existed. Say plainly that it's unbuilt.

## Still to build (from the status table, not re-discussed)

- Resolver Deadline and `ResolverUnavailable`. Today a silent resolver locks both bonds forever.
- Rename `OUTCOME_TOO_EARLY` to `NoConsensus`.
- Known gaps: a second `dispute_assertion` fails in Anchor's `init` before the `AssertionAlreadyDisputed` guard runs; `anchor build` warns about a program-ID mismatch.

## Open: fee model

Requirement: disputing your own assertion must cost more than fees.

- Why: only one first dispute can exist. Under the docs' rules (1% fee on every bond), a false asserter who expects to be caught can dispute themselves from a second wallet. They lose about 10 USDC instead of 500, and the honest disputer is locked out and earns nothing, so fewer people watch.
- What fixes it: the winner doesn't receive the whole losing bond; part goes to the treasury (UMA sends half to its Store). With 20% kept, a self-dispute costs 100 USDC. An honest retraction is still allowed and still cheaper than being caught by someone else.

Models considered, given that integrators create assertions:

- UMA-style: nothing on an undisputed assertion; on a dispute, a share of the losing bond goes to the treasury. Cheapest for integrators; revenue only from disputes, which should be rare.
- A flat per-assertion fee paid by the integrator at creation, plus the losing-bond share. Predictable revenue; doesn't tax larger bonds.
- A percentage of every bond (the docs today): taxes the honest path and, alone, doesn't stop self-disputes.

Other points:

- `ResolverUnavailable` stays fee-free, since Opal failed to deliver.
- Whether `NoConsensus` charges anything.
- Possibly no voting fee at launch. Voters are the scarcest resource, and it removes the rounding accounting.

## Open: resolver trust minimisation

Undecided. Three things are trusted today: that the resolver fetched sources honestly, ran the stated model on the stated prompt, and posted what the model said.

| Option                                      | Removes                                       | Catch                                                                                                   |
| ------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Post a hash of the report with each verdict | Quiet editing of the report afterwards        | Still a trusted key; costs 32 bytes                                                                     |
| Several independent resolvers must agree    | Trust in one operator                         | LLMs can disagree on honest runs; needs fixed settings and identical inputs                             |
| Resolver in secure hardware (TEE)           | Trust that the published code ran             | Trusts Intel/NVIDIA; no ready on-chain checker on Solana, so in practice you register the enclave's key |
| zkTLS proofs (e.g. Reclaim)                 | Trust that sources and the model API answered | Extra "attestor" parties; Solana support unconfirmed                                                    |
| zkML (prove the model ran)                  | Trust in the computation                      | Open models only; ~15 min for a 13B model; a 2026 attack fakes which model ran                          |

- The vote backstops the resolver, so a trustless resolver above a trusted vote gains little.
- A closed model (Claude, GPT) can't be made trustless; full verifiability needs an open-weight model.
- Jito NCN could later host a staked resolver operator set, if its slashing goes live.
- Switchboard shut down in September 2026. ADR-0002 and `protocol.md`'s "Not in the MVP" still mention it.

## Open: voting

We want trustlessness for sure. Whether the vote should be private is undecided.

Privacy trade-off:

- Private: an attacker can't size an attack, because they don't know how much stake already points the right way. But honest voters also can't see a bad vote forming and step in to save it.
- Public: honest voters can react, but a visible running tally pushes voters to follow the leader instead of reading the spec (ADR-0003's reason), and lets an attacker snipe at the end with exactly enough stake.
- Commit-reveal sits in between: choices hidden while voting, stake amounts visible.

Mechanisms considered:

| Mechanism                     | Hidden while voting     | Trust                                         | Notes                                                            |
| ----------------------------- | ----------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Public on-chain vote          | Nothing                 | Solana only                                   | Simplest                                                         |
| Commit-reveal                 | Choices; stake visible  | Solana only                                   | ~4 instructions; two transactions per voter; penalise non-reveal |
| MagicBlock private rollup     | Choice, stake, balances | Intel TDX, MagicBlock as operator, one rollup | Feasibility spike pending; the bulk of `vote-stage.md`           |
| Arcium (MPC)                  | Choices                 | At least one honest node among few operators  | Mainnet Alpha; official voting example                           |
| Accord (Kleros-style, Solana) | Choices (commit-reveal) | Its pool authorities and VRF                  | Random juror panels; pre-mainnet, unaudited, says not to use yet |
| Multisig arbiter (Devnet)     | n/a                     | The team                                      | One instruction; lets the full lifecycle ship while this is open |
| Jito NCN                      | n/a                     | Operator set                                  | Poor fit: operators not USDC voters, slashing not live           |

Low turnout:

- Chicken-and-egg, agreed. The open question is what a vote that misses quorum does while we grow.
- Today's docs: missed quorum gives `NoConsensus`, refunding every bond minus fees. The loser of an LLM verdict can always challenge from a fresh wallet and escape for about 10 USDC.
- Alternative: missed quorum lets the LLM verdict stand and the challenger loses their bond; `NoConsensus` only when quorum is met with no supermajority. This changes ADR-0007.

MagicBlock: not needed unless private stake is chosen. VRF only if we use random juror panels.

## Other considerations

- Unretrievable spec: `protocol.md` says a spec the resolver can't fetch gets no verdict, so bonds refund in full. An asserter could post a URI pointing at nothing and never be slashed. Consider having the resolver post `Unresolvable` after bounded retries (a silent resolver still gives `ResolverUnavailable`).
- Docs cleanups: "Not in the MVP" is in both `protocol.md` and the glossary; hardcoded 990/495 USDC sit next to the Parameters table; ADR numbers skip 4–6 without explanation; no state-machine or fund-flow diagram.
