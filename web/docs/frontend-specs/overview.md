# Overview

## What this app is

The web UI for Opal, an optimistic oracle on Solana. Users browse assertions, create
new ones, dispute/challenge/vote on them, and view per-user activity dashboards. Today
the UI is a **fully built visual + interaction shell over mock data** — the protocol
logic exists on-chain in `programs/opal` (Anchor) but the frontend does not call it yet.

## Tech stack

| Concern         | Choice                                                                  | Notes                                                                          |
| --------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Framework       | Next.js 16.2.4, App Router                                              | ⚠️ Breaking changes vs. older Next — read `node_modules/next/dist/docs/` first |
| UI runtime      | React 19.2.4                                                            |                                                                                |
| Language        | TypeScript 5, `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` | Path alias `@/* → ./*`                                                         |
| Package manager | Bun                                                                     | `bun install`, `bun run dev`                                                   |
| Styling         | Tailwind CSS v4 (CSS-first, no `tailwind.config.js`)                    | Tokens in `app/globals.css` via `@theme inline`                                |
| Component style | shadcn `base-nova` + `@base-ui/react` primitives                        | `components.json`                                                              |
| Icons           | `@phosphor-icons/react`                                                 |                                                                                |
| Animation       | `motion` (imported as `m` from `motion/react`)                          |                                                                                |
| Variants        | `class-variance-authority` (`cva`)                                      | Used in `button.tsx`, `input-group.tsx`                                        |
| Auth            | `@privy-io/react-auth`                                                  | Social login + Solana embedded wallet                                          |
| Solana          | `@solana/kit` (`createSolanaRpc`)                                       | Only constructs an RPC object for Privy; not used by app code                  |
| Theming         | `next-themes` (class-based dark mode)                                   |                                                                                |

**Not present:** `@coral-xyz/anchor`, an IDL, program-ID/PDA derivation, any
`getAccountInfo`/`getProgramAccounts`/`sendTransaction` calls. Adding these is the
integration work.

## Run locally

```bash
cd web
cp .env.local.example .env.local   # fill in Privy app id + devnet RPC
bun install
bun run check-env                  # validates NEXT_PUBLIC_* vars
bun run dev                        # http://localhost:3000
```

Other scripts: `bun run build`, `bun run typecheck` (`tsc --noEmit`),
`bun run lint` / `lint:fix`, `bun run format` / `format:fix`.

> Build note: Privy pulls a large wallet/auth dependency tree; a cold `bun run build`
> can take several minutes.

## Directory map

```
web/
  app/                      # App Router routes (see routes.md)
    layout.tsx              # Root layout: fonts, <Providers>, <Navbar>
    page.tsx                # Landing (/)
    not-found.tsx           # 404
    font.ts                 # next/font/local declarations
    globals.css             # Tailwind v4 + all design tokens (oklch)
    assertion/
      browse/page.tsx       # Feed (/assertion/browse)
      browse/[id]/page.tsx  # Detail (/assertion/browse/[id]) — mock state machine
      make/page.tsx         # Create form (/assertion/make) — stubbed submit
    u/[address]/            # User dashboard section
      layout.tsx            # Sub-nav wrapper
      page.tsx              # Overview
      assertions/ disputes/ votes/ earnings/   # Activity tabs
  components/
    ui/                     # Design-system primitives (button, input, select, ...)
    assertion/              # Assertion detail + make-form sections + voting/dispute
    activity/               # Dashboard sub-navigation
    common/                 # Navbar, search, container, logo, corner markers
    landing/                # Marketing sections (hero, process, consumers, ...)
  data/assertion.ts         # THE mock data (10 AssertionAccount records)
  types/                    # index.ts (domain types), filters.ts (feed filters)
  lib/                      # labels, stats, env, helpers, cn()
  providers/                # theme / privy / wallet context composition
  hooks/use-hydrated.ts     # SSR-safe hydration flag
  scripts/check-env.ts      # env validation
  docs/                     # PRIVY_SETUP.md + this frontend-specs/ folder
```

## Mental model of the domain

An **assertion** moves through a state machine. The UI keys almost everything off
`assertion.state`:

```
Asserted ──dispute──▶ PendingLLM ──LLM posts──▶ AssertedLLM ──challenge──▶ PendingVote ──open──▶ Voting ──▶ Resolved
   │                                                   │                                                        ▲
   └────────── no dispute before deadline ─────────────┴──────────── finalize_undisputed ──────────────────────┘
```

- `Asserted` — optimistic default `True`, first dispute allowed during liveness window.
- `PendingLLM` — first dispute filed, waiting for the trusted LLM resolver result.
- `AssertedLLM` — LLM result posted; challenge window open.
- `PendingVote` — LLM result challenged; vote round initializing.
- `Voting` — private OPAL voting active (MagicBlock — placeholder).
- `Resolved` — terminal; `outcome` is set.

Outcomes: `True | False | Unresolvable` (legacy `TooEarly`, code 2, is merged into
`Unresolvable` and no path emits it). Full detail in [`data-model.md`](data-model.md) and
`../../../docs/`.
