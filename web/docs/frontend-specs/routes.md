# Routes

App Router routes under `web/app/`. Assertion and dashboard pages read the client store
(`lib/assertion-store.ts` via `useAssertions()`), which is seeded from the mock array
`data/assertion.ts`; the landing page is static. "Client" = has `'use client'`.

## Root layout & globals

- **`app/layout.tsx`** (Server) — sets `<html>` font classes + `suppressHydrationWarning`,
  wraps everything in `<Providers>` (theme → Privy → wallet) and renders `<Navbar>` then
  `{children}` (no outer `Container` — the dashed frame is landing-only, applied in
  `app/page.tsx`). Metadata: `title: 'OPAL'`.
- **`app/font.ts`** — the Geist family only: `GeistSans` (body), `GeistMono`
  (labels/eyebrows/numerics/addresses), and `GeistPixelSquare` (headings, weight 500).
  Variables `--font-geist-sans` / `--font-geist-mono` / `--font-geist-pixel-square` are
  applied on `<html>` in `layout.tsx` and mapped to tokens in `globals.css`.
- **`app/globals.css`** — Tailwind v4, all design tokens in oklch. See
  [`design-system.md`](design-system.md).
- **`app/not-found.tsx`** (Server) — minimal centered "404 - Page Not Found".
- **`app/template.tsx`** (Client) — remounts per navigation (Next template convention);
  wraps every page in a subtle motion fade/rise enter transition.

## Page table

| Route                            | File                                         | Type   | Renders                                                                                                                          | Data                                                  | Status                                                           |
| -------------------------------- | -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| `/`                              | `app/page.tsx`                               | Server | Landing: `Hero`, `Process`, `ResolutionLayers`, `InstructionFlow`, `Economics`, `ReadOracle`, `Consumer`, `Faq`, `Cta`, `Footer` | none (static)                                         | ✅ complete (marketing)                                          |
| `/assertion/browse`              | `app/assertion/browse/page.tsx`              | Client | Filter/sort feed of `AssertionCard`s + `feed-header`                                                                             | client store, `useWallet`                             | ✅ functional (mock)                                             |
| `/assertion/browse/[id]`         | `app/assertion/browse/[id]/page.tsx`         | Client | Full assertion detail + action panels + timeline                                                                                 | client store, `useWallet`                             | ⚠️ rich but **simulated** — see below                            |
| `/assertion/browse/[id]/dispute` | `app/assertion/browse/[id]/dispute/page.tsx` | Client | Dedicated dispute/challenge screen (make-style accordion: Claim → Reason → Stake Summary)                                        | client store, `useWallet`                             | ⚠️ UI complete, submit is a mock store transition                |
| `/assertion/browse/[id]/vote`    | `app/assertion/browse/[id]/vote/page.tsx`    | Client | Dedicated vote screen: large outcome cards (select → confirm bar), recorded state w/ live tally, blocked notices                 | client store, `useWallet`                             | ⚠️ UI complete, cast is a mock store update (`MOCK_VOTE_WEIGHT`) |
| `/assertion/make`                | `app/assertion/make/page.tsx`                | Client | Accordion create form                                                                                                            | constants + `useWallet`                               | ⚠️ UI complete, **submit stubbed**                               |
| `/u/[address]`                   | `app/u/[address]/layout.tsx` + `page.tsx`    | Client | Dashboard overview (hero stat, 6-stat grid, panels, recent table)                                                                | `filterAssertionsByAddress`, `computeAssertionStats`  | ✅ functional (mock)                                             |
| `/u/[address]/assertions`        | `.../assertions/page.tsx`                    | Client | User's assertions table w/ filter pills + search                                                                                 | mock                                                  | ✅ functional (mock)                                             |
| `/u/[address]/disputes`          | `.../disputes/page.tsx`                      | Client | Derived dispute rows (WON/LOST/LLM/VOTING) + P&L                                                                                 | mock via `deriveDisputes`                             | ✅ functional (mock)                                             |
| `/u/[address]/votes`             | `.../votes/page.tsx`                         | Client | Votes cast by the address (ACTIVE/SETTLED + ALIGNED/MISALIGNED sub-filter), each voter's real stake + reward                     | client store via `votesByAddress` (per-voter records) | ✅ functional (mock)                                             |
| `/u/[address]/earnings`          | `.../earnings/page.tsx`                      | Client | DISPUTE_WIN / BOND_RETURN rows (role-scoped to the address)                                                                      | client store via `deriveEarnings`                     | ✅ functional (mock)                                             |

Dynamic segments: **`[id]`** (assertion PDA id, via `useParams`) and **`[address]`**
(user pubkey, via `useParams`).

## Detail page — the simulated state machine (important)

`app/assertion/browse/[id]/page.tsx` is the most logic-heavy page. It:

- Loads the assertion by id **from the client store** (`lib/assertion-store.ts`),
  calls `notFound()` if missing.
- Renders a status header with a **live 1s-ticking countdown** on the state's active
  deadline (liveness / challenge / voting), plus `AssertionSection`, `DisputeAction`,
  `EconomicsSection`, `EvidenceSection`, and conditionally `LLMSection` +
  `VotingPanel`, with a `Timeline` sidebar.
- All **mock protocol transitions live in `lib/assertion-store.ts`** —
  `fileLlmDispute`, `submitLlmResolution`, `fileVoteDispute`, `openVote`, `castVote`,
  `finalizeAssertion` — simulating the full
  `Asserted → PendingLLM → AssertedLLM → PendingVote → Voting → Resolved` machine,
  including all three finalize paths and dispute settlement fields. They mirror
  `dispute_assertion` / `submit_mock_llm_resolution` / `challenge_llm_resolution` /
  `open_vote` / `finalize_*` from `programs/opal` and are the exact seams where real
  transaction submission must replace store updates.
- Dispute/challenge actions **navigate to the dedicated dispute screen** and vote casting
  **navigates to the dedicated vote screen** (below); the permissionless actions (post
  LLM verdict, open vote, finalize) are inline buttons on the `DisputeAction` card.
- Actions are deadline-gated (`isDeadlinePast`); user-triggered mock windows
  (challenge, voting) are **5 minutes** so the full flow is walkable in one session.
- Uses `MOCK_VOTE_WEIGHT` (5000) from `lib/assertion-store.ts`; the user's cast vote is
  tracked in the store (`useUserVote`) so it survives navigation between the detail and
  vote screens.

## Dispute screen

`app/assertion/browse/[id]/dispute/page.tsx` — a dedicated full-screen flow styled
like the make screen (bordered accordion + bottom stake CTA, Ctrl/Cmd+Enter section
nav). One screen serves **both dispute layers**, keyed by state:

- `Asserted` (liveness open) → **dispute mode** — challenges the default optimistic TRUE
  (`fileLlmDispute`).
- `AssertedLLM` (challenge window open) → **challenge mode** — challenges the proposed
  LLM outcome (`fileVoteDispute`).
- Any other state / expired window → a blocked notice with a back link.

Sections: **Claim** (read-only statement + what you're challenging + window countdown +
bond) → **Reason** (textarea, min 10 chars, kept offchain) → **Stake Summary** (bond,
target, win/lose payout). CTA is wallet-gated (`Sign in to …` → Privy login). On submit
it runs the store transition and routes back to the detail page.

## Make page — mock create

`app/assertion/make/page.tsx`:

- Multi-section accordion (`StatementSection`, `ParamsSection`, `EvidenceSection`,
  `SummarySection`) with keyboard nav (Ctrl/Cmd+Enter to advance, +Shift back).
- Validation: statement 10–280 chars (trimmed), must not end with `?`. Bond and dispute
  window are fixed protocol parameters: `ASSERTION_BOND_PUSD` (500 USDC) and a 7-day
  window. The primary button advances to the Claim Summary from any earlier section and
  only submits from there (a deliberate review step); the expiry preview is a live clock.
- `handleSubmit` builds a real `AssertionAccount` (mock base58 id, toy `mockHash` aux
  hash, liveness deadline from the chosen window, asserter = Privy address), adds it
  to the client store, and navigates to its detail page. No on-chain
  `create_assertion` tx yet — this is the seam for real integration. Created
  assertions live only in memory; a hard refresh of their URL 404s.

## User dashboard pattern

Every `/u/[address]/*` page is a Client Component that reads `address` from `useParams`,
calls `filterAssertionsByAddress(address, useAssertions())` against the client store, and
derives its view client-side (`computeAssertionStats`, `deriveDisputes`, `deriveVotes`,
`deriveEarnings`). Because the filter returns assertions where the wallet is the asserter
**or** a disputer, each derivation re-checks the role so cross-role rows (e.g. an
asserter's returned bond vs a disputer's winnings) aren't mis-attributed. Rows deep-link
to `/assertion/browse/{id}`.
