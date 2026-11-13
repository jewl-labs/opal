# Protocol

Opal resolves **rubric-relative truth** ([ADR-0001](adr/0001-rubric-relative-truth.md)): an Assertion is judged against its own Resolution Spec, never against universal reality. The statement is `True` by default. A first dispute goes to the trusted LLM resolver; a challenge of that verdict escalates to a private staked vote that decides the final outcome.

This file states each Devnet MVP rule once. Terms are in [glossary.md](glossary.md), the code is in [architecture.md](architecture.md), and the vote stage is in [vote-stage.md](vote-stage.md).

## Parameters

Every number lives here. Values are fixed per deployment at initialization, and Mainnet may use different ones.

| Parameter                | Devnet value                                                             | Notes                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Asset                    | USDC, 6 decimals                                                         | The only asset. The mint is a `ProtocolConfig` field so localnet can use a test mint.                              |
| Participant Bond         | 500 USDC (`500_000_000` atomic)                                          | Posted by the Asserter, LLM Disputer and Vote Disputer alike.                                                      |
| Bond Fee                 | 1% of each bond (5 USDC)                                                 | Withheld at settlement on every outcome, `NoConsensus` included. An unslashed bond refunds 495 USDC.               |
| Voting Fee               | 0.1% of Gross Voting Stake: `floor(stake_atomic × 10 ÷ 10,000)`          | Rounds down; the voter keeps the remainder. Taken after tallying, so it never changes quorum, weight or outcome.   |
| Assertion Dispute Window | 7 days                                                                   | From creation.                                                                                                     |
| LLM Dispute Window       | 7 days                                                                   | From the moment the LLM verdict is posted.                                                                         |
| Resolver Deadline        | 24 hours                                                                 | From the moment the first dispute is accepted.                                                                     |
| Voting Window            | 7 days                                                                   | Starts when the Voting PER session starts.                                                                         |
| Minimum Vote             | 1 USDC                                                                   | Any amount of at least 1 USDC; no maximum.                                                                         |
| Minimum deposit          | 1 USDC                                                                   | Per deposit into a Private Voting Balance. No withdrawal minimum.                                                  |
| Vote Quorum              | ≥ 3,000 USDC Gross Voting Stake and ≥ 10 distinct voting wallets         | Both required. A bonded wallet counts when it Votes. A round with no Votes fails.                                  |
| Supermajority            | 67%, inclusive                                                           | After quorum, on Gross Voting Stake: `outcome_stake × 10,000 ≥ total_stake × 6,700`. Integer cross-multiplication. |
| Vote setup reserve       | Capped lamports, set at initialization; value chosen with the vote stage | Paid by the Vote Disputer on top of the bond.                                                                      |
| Statement                | 1–280 UTF-8 bytes                                                        | Bytes, not characters.                                                                                             |
| Resolution Spec URI      | Exactly 48 bytes                                                         | `ar://` plus a 43-character ID.                                                                                    |
| Resolution Spec JSON     | ≤ 16,384 bytes                                                           | An Opal bound, not an Arweave limit.                                                                               |
| Resolver retries         | ≤ 2 per source request                                                   | Transient failures only. At most 1 model inference per job.                                                        |
| Resolver report          | Kept ≥ 90 days                                                           | Off-chain.                                                                                                         |

Opal charges only the Bond Fee and Voting Fee: nothing for creation, spec storage, deposits, claims, withdrawals or position publication. Solana, Arweave and provider costs fall on whoever submits. Opal sponsors none; an integrator may.

## Assertions

An Assertion is created with a statement, a Resolution Spec URI and a Participant Bond.

- **Assertion ID.** The client generates a fresh random keypair per Assertion. Its public key is the Assertion ID, unique and never reused, and the keypair signs `create_assertion` alongside the asserter. It grants no authority afterward; discard it only after creation confirms. Why: it stops an observer front-running a pending ID.
- **Immutability.** Once creation is accepted, the statement, spec URI, bond and deadlines cannot change. There is no edit, cancellation or early bond withdrawal. A correction is a new Assertion; the original continues to its own outcome.
- **Duplicates.** Identical statement and spec content may appear in several Assertions, each with its own ID, bond, windows and outcome. The protocol never names a canonical one.

### Statement rules

Creating clients and `create_assertion` both enforce them, so a custom client cannot bypass them. The statement is single-line UTF-8 of 1–280 bytes. The table pins the code points rather than delegating to a language runtime:

| Class                         | Code points                                                                                                                          | Rejected                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Control characters            | `U+0000–U+001F`, `U+007F–U+009F`                                                                                                     | anywhere                        |
| Line and paragraph separators | `U+2028`, `U+2029`                                                                                                                   | anywhere                        |
| Bidirectional controls        | `U+061C`, `U+200E–U+200F`, `U+202A–U+202E`, `U+2066–U+2069`                                                                          | anywhere                        |
| Boundary whitespace           | `U+0009–U+000D`, `U+0020`, `U+0085`, `U+00A0`, `U+1680`, `U+2000–U+200A`, `U+2028`, `U+2029`, `U+202F`, `U+205F`, `U+3000`, `U+FEFF` | as the first or last code point |

- Ordinary right-to-left letters stay valid.
- **Exact bytes.** Validated bytes are stored unchanged: no normalization, trimming or case change. Visually identical sequences can be byte-distinct, so integrations identify Assertions by Assertion ID. Why no NFC: client-only normalization is bypassable, and onchain it would put Unicode data into consensus.
- **Storage.** The bytes fill the start of the fixed 280-byte field, the rest is zero-filled, and a full-length statement needs no terminator. Readers decode the bytes before the first zero (or all 280) with fatal UTF-8 handling.
- **TypeScript clients** reject ill-formed strings (isolated surrogates), measure `new TextEncoder().encode(s).byteLength`, never `s.length`, and use one unchanged value for measurement, signing preview and transaction. `trim()`, `\s` and runtime Unicode predicates are not the definition.
- Client and program share conformance vectors covering every range and boundary position. Changing the table is a protocol change.

### Resolution Spec

The spec is immutable and time-independent. It names the authoritative sources and their priority, defines key terms, and says how to handle ambiguity.

- **No private evidence timing.** A spec cannot set an evidence cutoff, freeze a source version, exclude later corrections, or make the protocol wait for a date. Why: a private cutoff lets an asserter exclude inconvenient corrections and makes assertions incomparable. A spec that tries is malformed; clients reject it, and the resolver and voters treat it as `Unresolvable`.
- **Protocol-wide timing**. Each resolution action applies the unchanged spec to the latest relevant information from its sources when it acts, as that actor observes it. A correction in the LLM Dispute Window can motivate a challenge; one in the Voting Window can sway later Votes but never rewrites an accepted one. After a terminal outcome nothing reopens it; a new judgment needs a new Assertion.
- **Ordered sources**. Sources run from highest to lowest priority; one source satisfies this automatically. A multi-source spec states which source controls on conflict and whether a lower source substitutes when a higher one is unavailable. A source is unavailable when its fetch times out after the resolver's retries, fails, or returns a response that cannot be parsed under the spec. Gateway disagreement fails closed to `Unresolvable` unless the hierarchy settles it, as does any material conflict or availability gap the hierarchy leaves open. No actor invents a preference.
- **Format**. UTF-8 JSON with `schemaVersion: "1"`, validated against [resolution-spec-v1.schema.json](schemas/resolution-spec-v1.schema.json), which is normative for structure. Every creating client and the resolver also run the checks the schema cannot express:
  - raw size at most 16,384 bytes, checked before parsing and upload and again on the retrieved bytes;
  - a duplicate-key-aware parser rejects repeated decoded member names, so escaped and literal spellings collide;
  - definition terms are unique after trimming and case-sensitive NFC normalization, even when meanings differ;
  - sources are unique after WHATWG URL serialization with the fragment removed;
  - the final source cannot use `next-source`;
  - Draft 2020-12 `format` assertion is on, and each source URL is parsed to reject a non-lowercase scheme, empty hostname, embedded credentials, invalid syntax or a raw backslash.

  A later schema version never reinterprets an existing spec.

- **URI**. Exactly `ar://<id>`: lowercase scheme, then a 43-character unpadded base64url Arweave transaction or ANS-104 data-item ID (`A-Z a-z 0-9 _ -`). No gateway host, ArNS name, query, fragment or separate digest. It is stored as `resolution_spec_uri: [u8; 48]`, and clients and `create_assertion` reject any other spelling. The program checks byte shape only; it cannot fetch Arweave. One verified URI may back several Assertions.
- **Before signing**, the creating client validates the JSON, uploads it, retrieves it by ID, and proves from Arweave signature and data-root verification that the served bytes match the ID. It repeats the size, UTF-8, schema and cross-field checks on those bytes and refuses to sign on any failure; a reused upload gets the same checks. The asserter normally pays for the upload.

## Lifecycle

| Instruction                     | Transition                            | Caller                                                    | When                                                       |
| ------------------------------- | ------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| `create_assertion`              | → `Asserted`                          | Asserter plus the Assertion ID keypair                    | any time                                                   |
| `dispute_assertion`             | `Asserted` → `PendingLLM`             | LLM Disputer: any wallet but the asserter                 | before the Assertion Dispute Window ends                   |
| `submit_llm_resolution`         | `PendingLLM` → `AssertedLLM`          | `ProtocolConfig.resolver` only                            | before the Resolver Deadline; opens the LLM Dispute Window |
| `finalize_resolver_unavailable` | `PendingLLM` → `ResolverUnavailable`  | anyone                                                    | at or after the Resolver Deadline                          |
| `challenge_llm_resolution`      | `AssertedLLM` → `PendingVote`         | Vote Disputer: a wallet distinct from both bonded wallets | before the LLM Dispute Window ends                         |
| `finalize_undisputed`           | `Asserted` → `Resolved` (`True`)      | anyone                                                    | at or after the Assertion Dispute Window ends, no dispute  |
| `finalize_llm_resolution`       | `AssertedLLM` → `Resolved`            | anyone                                                    | at or after the LLM Dispute Window ends, no challenge      |
| vote stage                      | `PendingVote` → `Voting` → `Resolved` | see [vote-stage.md](vote-stage.md)                        | see [vote-stage.md](vote-stage.md)                         |

- **Non-final answer.** `Asserted` holds the default `True`. `AssertedLLM`, `PendingVote` and `Voting` hold the LLM verdict, under challenge in the last two. `PendingLLM` holds none. `Resolved` and `ResolverUnavailable` are terminal and never change.
- **Deadline boundary.** An action that must land before a deadline needs `now < deadline`; a finalizer needs `now >= deadline`. The deadline instant belongs to the next phase. The Voting Window follows the same rule, measured at execution on the Voting PER.
- **Finalization is permissionless and deterministic.** A deadline passing executes nothing. Until a finalizer lands the Assertion stays pre-final, so integrators must not infer a result from the clock. The caller cannot pick the outcome or redirect funds, and pays the transaction cost.
- **Dispute race.** The first valid transaction accepted before the deadline becomes the bonded disputer and locks a bond. Later or retried ones fail before any bond moves or fee accrues.
- **Role separation.** The Asserter, LLM Disputer and Vote Disputer are three distinct wallets (wallet-level only; not proof of three people). Any may also Vote, for any outcome.

## Outcomes and fault

| Outcome                        | Code | Produced by                | Meaning                                                                                                      | Who is wrong                    | Fees                       |
| ------------------------------ | ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- | -------------------------- |
| `True`                         | 0    | undisputed, resolver, vote | The spec, applied, verifies the statement                                                                    | LLM Disputer                    | ordinary                   |
| `False`                        | 1    | resolver, vote             | The spec, applied, contradicts the statement                                                                 | Asserter                        | ordinary                   |
| `NoConsensus`                  | 2    | vote only                  | The vote found no winner: quorum failed (including no Votes) or no option reached the Supermajority          | nobody: no slashing, no rewards | ordinary                   |
| `Unresolvable`                 | 3    | resolver, vote             | The statement cannot be decided under the spec: unclear priority, conflicting or missing evidence, ambiguity | Asserter                        | ordinary                   |
| `ResolverUnavailable` (status) | none | timeout finalizer          | The resolver posted no verdict in time; no truth judgment, so `outcome` stays `None` (255)                   | nobody                          | none; bonds refund in full |

- **Correctness.** The Asserter is correct only on `True`. The LLM Disputer is correct on `False` or `Unresolvable`. The Vote Disputer is correct when the final outcome differs from the LLM verdict it challenged. `NoConsensus` assigns correctness to nobody.
- **Why `Unresolvable` assigns fault:** [ADR-0007](adr/0007-unresolvable-vs-no-consensus.md). In a vote it must reach the Supermajority like any option.
- The resolver may post `True`, `False` or `Unresolvable`, never `NoConsensus`. Consumers ignore `outcome` unless the state is `Resolved`.

## Settlement before voting

The recipient set is fixed and small, so payouts are pushed automatically to the owners' public token accounts. The program derives every recipient; the caller cannot redirect anything. Fees go to `ProtocolConfig.treasury`.

- **Undisputed.** The asserter receives 495 USDC and the treasury 5.
- **LLM verdict not challenged.** Winner Takes Remaining Bond: the correct side receives its own bond minus the Bond Fee plus the loser's bond minus the Bond Fee, 990 USDC, and the treasury keeps 10. `True` favors the Asserter; `False` and `Unresolvable` favor the LLM Disputer.
- **`ResolverUnavailable`.** The asserter and LLM Disputer each get the full 500 USDC back in one atomic transaction, with no Bond Fee, slashing or reward. It is the only case where a bond pays no fee. Why: Opal failed to deliver the service. Reusing `Unresolvable` would blame the asserter, and reusing `NoConsensus` would imply a vote.
- **Voted Assertions.** Settlement and payout delivery are in [vote-stage.md](vote-stage.md).

## Trusted LLM resolver

`submit_llm_resolution` requires the signer to equal `ProtocolConfig.resolver`. That key is separate from `ProtocolConfig.authority`, so a leaked hot key can only post a challengeable verdict ([ADR-0002](adr/0002-trusted-llm-resolver.md)).

- **Verdicts.** `True`, `False` or `Unresolvable`, accepted only before the Resolver Deadline and rejected afterward.
- **Key lifecycle.** Only the authority can replace or revoke the resolver key, immediately. A replaced or revoked key cannot submit. Every change emits an auditable event. A change does not extend a pending Resolver Deadline.
- **Frozen policy.** When a first dispute is accepted, the job freezes the resolver-policy version then active: provider, immutable model revision (not a mutable alias), decoding and tool parameters, prompt template, extraction code, network limits and output parser. A later policy applies only to later jobs. The deployment manifest publishes each version and its activation time.
- **Retrieval.** The job fetches the spec by ID, verifies its integrity, runs the spec checks above, then fetches sources in priority order. Every request is HTTPS-only, carries no ambient credentials, follows only HTTPS redirects, revalidates the destination on each redirect, rejects non-public addresses (loopback, private, link-local, multicast, unspecified), defeats DNS rebinding by connecting through controlled egress or to a validated address, and bounds time, redirects, decompressed bytes and content types.
- **Retries.** A timeout, temporary DNS failure, HTTP 408, 429 or 5xx gets at most two retries with bounded backoff. Policy denial, invalid TLS, unsupported content, an oversized response or exhausted retries make the source unavailable at once. The job then applies that source's `unavailableBehavior`; it never skips, substitutes or invents precedence.
- **Verdict from evidence.** An available source whose contents cannot decide the statement yields `Unresolvable`, not an outage. A verified spec that fails the structural or cross-field checks (a bypassing client can commit one; the program cannot validate content) yields `Unresolvable` with no model call. A spec that cannot be retrieved or verified yields no verdict, and the Resolver Deadline applies.
- **One inference.** At most one logical model request. The prompt holds the exact statement, validated spec, source material and retrieval metadata, and an output contract of `True`, `False` or `Unresolvable` plus a non-normative rationale. Model tools are off; all retrieval runs first through the pinned fetcher. Retrieved text is labeled untrusted evidence and cannot add instructions, alter the statement or spec, or override policy. A transport retry needs a provider idempotency key proving it is the same request. After an ambiguous or completed inference there is no fresh call, model switch, sample voting or heuristic answer. Invalid output or provider failure yields no verdict, and the Resolver Deadline then applies.
- **Report.** The service keeps a structured report per Assertion: policy, provider and model identifiers, retrieval statuses, final URLs, response hashes, exact prompt, raw response, verdict and rationale. It is diagnostic, not protocol evidence, and cannot override the verdict or the spec.

## Records

- Permanent public records (the Assertion, its disputes and rounds, public payout-status and position records) are never closable, and their creation cost is non-recoverable. Why: integrators bind irreversible actions to an Assertion ID.
- Closable transient accounts record their creation payer as an immutable Rent Refund Recipient. Reclaimed lamports return there, never to the caller or treasury, and the caller controls neither eligibility nor destination. Vote-stage closure checks are in [vote-stage.md](vote-stage.md).

## Devnet authority and treasury

- One single-signature Opal-team wallet is the program upgrade authority, `ProtocolConfig.authority` and owner of the treasury USDC token account. The resolver is a separate signer with only its role.
- No multisig, timelock, withdrawal cap or program-governed spending policy exists, and the program has no treasury-withdrawal instruction. The wallet can move treasury USDC at any time under the SPL Token program.
- The program stays upgradeable with no advance onchain delay. It is not immutable, trustless, multisig-controlled or timelocked.
- Program, authority, treasury token-account and treasury-owner addresses are published only when the completed deployment is officially designated. No development or test address is official.

## Integrator rules

- Before any irreversible action (resolving, voiding, refunding, consuming an Opal result), read the exact Assertion account at `finalized` commitment. `processed`, `confirmed` and indexer-only views are not enough; indexers serve discovery and UI.
- Consume a truth outcome only when the state is `Resolved`.
- Treat `ResolverUnavailable` as terminal with no truth. Act on it only through an explicit non-truth policy.
- `Unresolvable`, `NoConsensus` and `ResolverUnavailable` differ in meaning and economics; keep the reason even if you handle them alike.
- Before trusting an outcome, retrieve the spec by its ID, verify it, and read it. The protocol applies a bad spec faithfully.
- Identify an Assertion by its Assertion ID and pick the exact one you consume. Wait for position publication only if you enumerate voters ([vote-stage.md](vote-stage.md)).
- **Amounts.** On-chain amounts are `u64` atomic units. TypeScript uses `bigint`, with `BN` only at the generated-binding boundary and never via `number`. JSON uses unsigned base-10 integer strings: digits only, within `u64`. 500 USDC is `500000000n` and `"500000000"`.

## Vote stage

A challenge of the LLM verdict (`challenge_llm_resolution`) starts a private USDC-staked vote that decides the final outcome. The outcome and fault rules above apply unchanged; vote-stage payouts are claimed rather than pushed. The vote is gated on a MagicBlock feasibility spike ([ADR-0003](adr/0003-private-staked-voting.md)). Mechanics, settlement and claims are in [vote-stage.md](vote-stage.md).

## Not in the MVP

- **OPAL token.** Governance is the `authority` key and voting weight is staked USDC.
- **Trustless or permissionless resolver** (Switchboard, attested inference).
- **On-chain resolver provenance.** No prompt, response, evidence or model hash goes on-chain.
- **Proof-of-personhood, sub-linear weighting and stake-duration reputation.** Distinct-wallet rules do not prove distinct people.
- **Timed resolution.** A future `resolves_at` would be a protocol field, never spec content.
- **Source or truth-change invalidation.** The current-information rule stands.
- **TWAV voting.** Rejected: weighting early votes empowers a first-moving attacker.
- **Commit-reveal voting.** Only the fallback if the feasibility spike fails ([vote-stage.md](vote-stage.md)).
- **Vote-setup abort or timeout.** A stalled `PendingVote` keeps its bonds locked until setup resumes.
- **Mainnet authority and treasury policy.** Undecided; Devnet promises nothing about it.
