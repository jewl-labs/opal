# Conventions for frontend agents

Rules to follow when editing `web/`. These combine the repo's `AGENTS.md`/`CLAUDE.md`
guidance with frontend-specific realities.

## Before you write code

- ⚠️ **Next.js 16 has breaking changes vs. training data.** `web/AGENTS.md` says: read the
  relevant guide in `node_modules/next/dist/docs/` before writing Next code, and heed
  deprecation notices. Do not assume older App Router / `next/*` APIs.
- Prefer editing existing components/helpers over adding new ones. The label/stat helpers
  in `lib/` already centralize domain→display logic — reuse them.

## Working style (from repo `AGENTS.md`)

- **Simplicity first** — minimum code that solves the problem; no speculative
  abstractions, no config that wasn't asked for.
- **Surgical changes** — touch only what the task requires; match existing style; don't
  refactor unrelated code. If you notice dead code (e.g. items in [`status.md`](status.md)),
  mention it — don't silently delete unless asked.
- **State assumptions / surface tradeoffs** before implementing when the task is ambiguous.

## Code conventions

- **TypeScript is strict** (`noUncheckedIndexedAccess`, `noImplicitReturns`). Avoid `as
any` — the existing dashboard casts are debt to pay down, not a pattern to copy.
- **Type imports:** ESLint enforces `consistent-type-imports` — use `import type { ... }`.
- **Unused vars:** prefix intentionally-unused with `_`.
- **Path alias:** import via `@/*` (e.g. `@/components/ui/button`, `@/lib/utils`,
  `@/types`).
- **`'use client'`** only where you use hooks/state/events/animation. Presentational
  sub-components can stay server-safe if rendered inside a client tree.
- **Class merging:** use `cn()` from `@/lib/utils`. Prefer `cva` variants (as in
  `button.tsx`) for anything with multiple visual states.
- **Icons:** `@phosphor-icons/react` only. **Animation:** `motion` (`m` from
  `motion/react`, `AnimatePresence`).
- **Auth/address:** always go through `useWallet()` from `@/providers/wallet-context`;
  gate auth-dependent UI with `useHydrated()` to avoid SSR mismatch.

## Design consistency

Match the established aesthetic (uppercase wide-tracked labels, dashed borders, monospace
numerics, lime primary accent, corner markers). See [`design-system.md`](design-system.md).
Use `ui/` primitives instead of raw `<button>/<input>/<select>`.

## Data layer

- Today: mock data in `data/assertion.ts`; the frontend `AssertionAccount` type
  (`types/index.ts`) is the contract. Any new UI should consume that type, so it survives
  the switch to real accounts.
- **Do not hardcode new mock records** into components — extend `data/assertion.ts` if you
  need fixtures, and keep the type as the interface.
- `outcome` is only meaningful when `state === 'Resolved'`.

## Verify before you finish

- `bun run typecheck` (`tsc --noEmit`) — must pass.
- `bun run lint` and `bun run format` — must pass (pre-commit runs lint-staged).
- If you changed a real user flow, exercise it in `bun run dev` (see the `/run` and
  `/verify` skills) — don't rely on typecheck alone.

## Housekeeping

- When you complete or invalidate something in [`status.md`](status.md), update that file.
