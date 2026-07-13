# Frontend change tracking — branches, work landed, work planned

Running log of frontend work streams so branches/commits/PRs stay traceable. Newest
first. Update this file whenever a work stream starts, lands, or changes scope.

## Branch map

| Branch                    | Base                      | Status                      | PR                                  |
| ------------------------- | ------------------------- | --------------------------- | ----------------------------------- |
| `frontend/design-revamp`  | `frontend/mock-lifecycle` | in progress                 | not opened yet (user will say when) |
| `frontend/mock-lifecycle` | `main`                    | committed locally, unpushed | not opened yet (user will say when) |

> Note: `git push` over https currently fails (account lacks push permission to
> `jewl-labs/opal`) — resolve auth before opening PRs.

## 2026-07-13 — `frontend-revamp` (PR #28 review round)

Review follow-ups on the open PR:

- **Make form**: bond raised to a fixed **500 USDC** and the dispute window fixed at
  **7 days** (window picker + the bond's "Fixed" chip removed); the primary button now
  routes to the Claim Summary from any earlier section and only submits there; the expiry
  preview is a live clock (accurate at submit time, not page-open).
- **Dashboard rework**: per-voter records (`VoteRecord[]` on each vote round) added; the
  votes tab is rebuilt around **ACTIVE/SETTLED** status with **ALIGNED/MISALIGNED** as a
  sub-filter (only after a vote settles) and each voter's real stake/reward; each tab now
  has a domain-specific summary header instead of the shared stat bar; disputes are
  role-scoped to the filer. A `DEMO_USER` persona seeds cross-tab data and the empty state
  links to it.
- **Fixes**: navbar logo marked `priority` (LCP); `integration-roadmap.md` removed;
  correctness/bug + doc-accuracy fixes from earlier in the review.

## 2026-07-05 — `frontend/design-revamp` (in progress)

Premium look-and-feel revamp per user direction (references: Bullet, Lotus, Lighter).

- **Typography → Geist family only** (`geist` npm package; local font files deleted):
  Geist Sans body, Geist Mono labels/numerics, **Geist Pixel Square for all headings**.
  Old Khand/Hind faces removed. `app/font.ts` re-exports; variables attached in
  `app/layout.tsx`.
- **`globals.css`**: de-duplicated (every token/`@theme`/base block was defined twice);
  new font vars; root font-size back to 100%; heading base rule now weight 500;
  `kbd/code/samp` → mono. **Dark palette deepened to near-black**
  (bg `oklch(0.1448 0 0)`, cards/borders re-tuned).
- **Type system re-tiered across every page**: pixel headings (no bold, no tracking
  overrides, sizes reduced ~1 notch), `font-mono uppercase tracking-widest`
  micro-labels/chips/addresses, body copy back to **sentence case** (was uppercase
  everywhere), numerics `font-mono tabular-nums`.
- **Buttons**: global mono/uppercase label style (`font-mono text-xs tracking-[0.15em]`).
- Kept per user preference: dashed outer page frame, corner-tick markers, horizontal
  hairlines, lime primary accent, squared corners.
- **Functional fixes**: `/u/[address]` sub-pages (assertions/disputes/votes/earnings)
  rewired from the static mock array to the live client store; `as any` casts removed;
  `MISALIGNED` vote status now actually derived.
- Docs: this file added; `design-system.md` + `status.md` updated.
- **Layout**: the `max-w-400` + dashed `border-x` frame is now **landing-only**; all app
  routes (browse/detail/make/dispute/vote/dashboard, 404) render full-bleed, and the
  navbar switches frame per route (`usePathname` in `NavbarFrame`).
- **UI feedback round** (user screenshots): dashboard tab bar full-width; bright
  header hairlines dimmed to `border-border` on app pages (navbar bottom line stays
  dashed/brighter on landing only); detail/vote statement uses the pixel heading face
  and the detail content centers vertically (`my-auto` in the scroll column); evidence
  modal reframed (no gradient line — framed header bar like the search dialog); ⌘K
  dialog moved outside the blurred navbar (backdrop-filter containing block was
  trapping its `fixed` positioning) and docked at 18vh; Select trigger/popup/items
  restyled as mono uppercase chips; make/dispute accordions got numbered step markers
  with complete/active states and a visible disabled submit bar.

## 2026-07-05 — `frontend/mock-lifecycle` (committed: f56131e, 49d4163 + f332aa6)

- `docs/frontend-specs/` added (9-file spec set).
- Client-side assertion store (`lib/assertion-store.ts`) with all mock protocol
  transitions; full lifecycle walkable end-to-end.
- Dedicated `/assertion/browse/[id]/dispute` and `/vote` screens; make form creates
  real store records; `app/template.tsx` page transitions.
- (Superseded within the revamp branch:) Khand/Hind font swap.
- Included prior WIP `f332aa6` (corner markers, navbar/landing cleanups).

## Planned / future work streams

- **On-chain integration** (the big one): Anchor/IDL reads, PDA derivation, tx submission
  via the Privy embedded wallet, account subscriptions. Suggested branch:
  `frontend/anchor-reads` then `frontend/anchor-txs`.
- **Aux-data storage/retrieval** for evidence (`auxiliaryUrl`/`auxiliaryHash`).
- **Landing art pass**: hero/process SVG illustrations could be re-cut to match the
  pixel-font language (dither/pixel motifs, alternate Geist Pixel variants for
  decorative numerals).
- Mobile polish sweep once the desktop language settles.
