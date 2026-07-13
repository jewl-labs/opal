# Data model

The frontend's domain types (`web/types/`) mirror the on-chain Anchor accounts but use
frontend-friendly shapes (ISO date strings instead of unix `i64`, string outcomes
instead of `u8` codes, nested objects instead of PDA pointers). Today they are populated
by the mock array in `data/assertion.ts`; on integration they must be populated by
decoding real accounts. See `../../../docs/architecture.md` for the authoritative
on-chain layout.

## Types — `types/index.ts`

```ts
type AssertionState =
  | 'Asserted'      // default True; disputable during liveness window
  | 'PendingLLM'    // first dispute filed; awaiting the trusted LLM resolver
  | 'AssertedLLM'   // LLM result posted; challenge window open
  | 'PendingVote'   // LLM result challenged; vote round initializing
  | 'Voting'        // MagicBlock private voting active (placeholder)
  | 'Resolved';     // terminal; outcome set

type ResolutionOutcome = 'True' | 'False' | 'Unresolvable';  // legacy TooEarly merged into Unresolvable

interface LLMResolutionRound {
  pubkey: string;
  outcomeCode: 0 | 1 | 3;             // 0=True 1=False 3=Unresolvable (2 reserved — legacy TooEarly)
  outcome: ResolutionOutcome | null;
  promptHash?: string;                // illustrative mock; not read by the UI
  resolvedAt: string | null;
  challengeDeadline: string | null;
}

interface VoteRecord {                                // one voter's stake on one side
  voter: string;
  outcome: ResolutionOutcome;
  weight: number;
}

interface VoteResolutionRound {
  pubkey: string;
  votingStartsAt: string | null;
  votingDeadline: string | null;
  totalValidWeight: bigint;                          // note: bigint (e.g. 48200n)
  aggregateVotes: Record<ResolutionOutcome, number>; // per-outcome weight
  voters?: VoteRecord[];                             // per-voter records (mock; drives the votes tab)
  finalOutcome: ResolutionOutcome | null;
}

interface LLMDisputeAccount {
  pubkey: string;
  disputer: string;
  bondAmountPUSD: number;
  createdAt: string;
  settlementResolution: ResolutionOutcome | null;
  disputeCorrect: boolean | null;
  settled: boolean;
}

interface VoteDisputeAccount extends LLMDisputeAccount-shape {
  challengedLLMResolution: ResolutionOutcome | null; // + all LLMDisputeAccount fields
}

interface AssertionAccount {
  id: string;                 // assertion PDA pubkey
  asserter: string;           // wallet pubkey
  statement: string;
  auxiliaryHash: string;      // SHA-256 of offchain aux text
  auxiliaryUrl?: string;      // optional pointer to aux text (e.g. arweave)
  bondAmountPUSD: number;
  state: AssertionState;
  livenessDeadline: string;
  outcome: ResolutionOutcome | null;   // meaningful only when state === 'Resolved'
  finalizedAt: string | null;
  disputeCount: 0 | 1 | 2;
  llmDispute: LLMDisputeAccount | null;
  voteDispute: VoteDisputeAccount | null;
  llmResolutionRound: LLMResolutionRound | null;
  voteResolutionRound: VoteResolutionRound | null;
  createdAt: string;
}
```

## Filter types — `types/filters.ts`

```ts
type StageFilter = 'All' | 'Optimistic' | 'AwaitingLLM' | 'LLMResolved' | 'Voting' | 'Finalized';
type QuickFilter = 'onlyDisputed' | 'highStakes' | 'myAssertions' | 'watching' | 'unresolved';
type SortField =
  | 'newest'
  | 'oldest'
  | 'endingSoon'
  | 'highestBond'
  | 'mostDisputed'
  | 'recentlyResolved';
```

## Mock data — `data/assertion.ts`

- `ASSERTION_BOND_PUSD = 500` — the fixed demo bond.
- `DEMO_USER` — a demo persona that is asserter, disputer, and voter across the seed set so
  every dashboard tab has data; the dashboard empty state links to `/u/<DEMO_USER>`.
- `ASSERTIONS: AssertionAccount[]` — **10 records** covering every lifecycle state and
  both open and expired windows (open dispute window, expired liveness →
  finalize-undisputed, open + expired challenge windows, closed voting → finalize-vote,
  plus three `Resolved`: False, Unresolvable ×2). `totalValidWeight` uses
  `bigint` literals (`48200n`). Several fields carry `// FIXED` comments marking
  hand-patched state consistency.
- `filterAssertionsByAddress(address)` — returns assertions where the address is the
  `asserter`, `llmDispute.disputer`, or `voteDispute.disputer`. Powers the entire
  `/u/[address]` dashboard.

### Client store — `lib/assertion-store.ts`

The assertion pages don't read `ASSERTIONS` directly anymore: `lib/assertion-store.ts`
wraps it in a client-side in-memory store (`useSyncExternalStore`) exposing
`useAssertions()`, `addAssertion()`, and `updateAssertion(id, updater)`, plus the
**mock protocol transitions** — `fileLlmDispute`, `submitLlmResolution`,
`fileVoteDispute`, `openVote`, `castVote`, `finalizeAssertion` — each mirroring the
corresponding `programs/opal` instruction. Created assertions and lifecycle transitions
persist across navigation (and reset on hard refresh). This is the single module to
replace with real account fetching + transaction submission on integration.

## Mapping to on-chain accounts (for integration)

| Frontend field                               | On-chain source (`AssertionAccount`, `#[repr(C, packed)]` zero-copy)                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                         | `id: Pubkey` (also the seed for the `[b"assertion", id]` PDA)                                                                        |
| `asserter`                                   | `asserter: Pubkey`                                                                                                                   |
| `statement`                                  | `statement: [u8; 280]` (null-terminated) → UTF-8 string                                                                              |
| `auxiliaryHash`                              | `auxiliary_hash: [u8; 128]`                                                                                                          |
| `bondAmountPUSD`                             | `assertion_bond_amount_pusd: u64` (raw base units → display)                                                                         |
| `state`                                      | `state: u8` → enum: 0 Asserted, 1 PendingLLM, 2 AssertedLLM, 3 PendingVote, 4 Voting, 5 Resolved                                     |
| `outcome`                                    | `outcome: u8` (255 = unset/`None`) → 0 True, 1 False, 3 Unresolvable (code 2 = legacy TooEarly, reserved — never surfaced in the UI) |
| `livenessDeadline`                           | `liveness_deadline: i64` (unix) → ISO string                                                                                         |
| `finalizedAt`                                | `finalized_at: i64` (0 = unset)                                                                                                      |
| `disputeCount`                               | `dispute_count: u8`                                                                                                                  |
| `llmDispute` / `voteDispute`                 | `llm_dispute` / `vote_dispute: Pubkey` (default = unset) → fetch `LlmDisputeAccount` / `VoteDisputeAccount`                          |
| `llmResolutionRound` / `voteResolutionRound` | `llm_resolution_round` / `vote_resolution_round: Pubkey` → fetch round accounts                                                      |

Key gotchas when decoding:

- Accounts are **zero-copy `#[repr(C, packed)]`** — no `Option`/`bool`/enums on-chain.
  Sentinels: `Pubkey::default()` unset, `0` unset timestamp, `255` (`OUTCOME_NONE`) unset
  outcome, `BOOL_TRUE`/`BOOL_FALSE` flags.
- **`outcome` is only meaningful when `state === 'Resolved'`.** Ignore it otherwise (the
  mock data even sets `outcome: 'True'` on non-resolved records — do not trust it).
- Field names on-chain still say `pusd` / `*_pusd`; the protocol supports any USD-pegged
  stablecoin. A future program PR renames these to `usd`. Frontend uses `PUSD` today.
- LLM outcome codes come from a **single trusted off-chain LLM resolver** (the 3-feed
  Switchboard council was removed per ADR-0002; the mock posts via
  `submit_mock_llm_resolution`). Vote round is a **MagicBlock placeholder** —
  `totalValidWeight` / `aggregateVotes` are not produced by real voting yet.

## Label / stat helpers — `lib/`

- `assertion-labels.ts`: `getStageLabel`, `getOutcomeLabel`, `getFinalizationStatus`
  (`optimistic|pending|finalized`), `getContextualMessage`, `getDisputeLevel`
  (`none|llm|vote`). These centralize state→display mapping — reuse them, don't inline.
- `assertion-stats.ts`: `computeAssertionStats(assertions)` →
  `{ totalAssertions, totalDisputes, activeAssertions, totalBondPUSD, totalValidWeight }`;
  `topControversialAssertion(assertions)`.
- `helpers.ts`: `getTimeRemaining(deadline)` → `"3d 4h 12m"` / `"Expired"`.
- `utils.ts`: `cn(...)` (clsx + tailwind-merge).
