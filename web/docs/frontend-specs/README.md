# Opal Frontend Specs

Single source of truth for anyone (human or agent) working on the Opal web frontend
(`web/`). Read this index first, then jump to the relevant file.

Opal is a **Solana-native optimistic oracle** for natural-language statements. A
statement is treated as `True` by default; if nobody disputes it within a liveness
window it resolves `True`, otherwise it escalates through an LLM resolution round and
(if that is challenged) a private voting round. The frontend is the UI over this
lifecycle. See `../../../docs/` for protocol-level docs (architecture, resolution,
tokenomics, glossary).

## The one thing to know first

**The frontend has NO on-chain integration yet.** Everything renders from a hardcoded
mock array (`data/assertion.ts`, 10 records). The only real external system wired in is
**Privy** (social login + auto-created Solana devnet embedded wallet), and that wallet
is used only for identity/address display — never to read accounts or sign
transactions. Every "dispute", "vote", "finalize", and "create assertion" action is a
local-state simulation or a `router.push`. Wiring this to the Anchor program is the
central open task. See [`status.md`](status.md).

## Files in this folder

| File                                       | What it covers                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| [`overview.md`](overview.md)               | Tech stack, how to run, high-level mental model, directory map         |
| [`routes.md`](routes.md)                   | Every page/route, what it renders, client/server, data source, status  |
| [`components.md`](components.md)           | Full component inventory grouped by folder                             |
| [`data-model.md`](data-model.md)           | TypeScript types, the mock data shape, mapping to on-chain accounts    |
| [`design-system.md`](design-system.md)     | Styling conventions, tokens, UI primitives, aesthetic rules            |
| [`auth-and-wallet.md`](auth-and-wallet.md) | Privy config, wallet context, env vars, hydration handling             |
| [`status.md`](status.md)                   | What's done, what's stubbed, known bugs/cleanup items                  |
| [`conventions.md`](conventions.md)         | Rules an agent must follow when editing this codebase                  |
| [`changelog.md`](changelog.md)             | Branch map + running log of frontend work streams (landed and planned) |

## Quick facts

- **Framework:** Next.js **16.2.4** (App Router), React **19.2.4**, Tailwind CSS **v4**.
- ⚠️ **Next 16 has breaking changes vs. training-data Next.** `web/AGENTS.md` says to
  read `node_modules/next/dist/docs/` before writing code. Do not assume older APIs.
- **Package manager / runtime:** Bun.
- **UI primitives:** `@base-ui/react` (shadcn "base-nova" style), Phosphor icons,
  `motion` (Framer Motion successor) for animation, `cva` for variants.
- **Cluster:** Solana **devnet only** (hardcoded/enforced; any other cluster throws).
- **State of truth:** mock data; see the warning above.
