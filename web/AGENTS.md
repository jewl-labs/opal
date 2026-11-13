<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code, even for a change that "looks like a one-liner." Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Opal web — agent guide

The Next.js frontend for Opal. This file is the single source of agent guidance for `web/`; it covers operational and web-specific concerns only.

**For protocol semantics — the state machine, outcomes, bond math, resolution flow — read the root [`/docs`](../docs/), not this file.** Start with [`docs/glossary.md`](../docs/glossary.md) and [`docs/architecture.md`](../docs/architecture.md); the locked design decisions live in [`docs/adr/`](../docs/adr/). Do **not** restate or paraphrase protocol rules here — keeping them in one place is deliberate, and the old copy of them in `web/` had drifted.

## Stack & integration status

- **Privy** provides social login and an **embedded Solana wallet** on **Solana devnet** (there is no localnet mode for the web app). `PrivyProvider` is mounted via the `Providers` client wrapper that the root layout renders (`providers/privy-provider.tsx`), so it wraps every page. Production builds therefore compile a large wallet/auth dependency tree — expect a multi-minute `bun run build` on a cold cache.
- **Assertion browse/make flows use MOCK data** ([`data/assertion.ts`](data/assertion.ts)) for listings and submit navigation. The web app does **not** consume the Anchor IDL or `target/` artifacts yet — there is no on-chain client integration. Build toward it, but don't assume it exists.
- The mock data still uses **`PUSD` naming** (`ASSERTION_BOND_PUSD`, `bondAmountPUSD`, etc.). This is **local-only and harmless** — it mirrors the program's current `*_pusd` field names, which rename to `*_usdc` in a later protocol PR (see [`docs/protocol.md`](../docs/protocol.md)). When that rename lands and the web app starts consuming the IDL, this mock follows. Until then, leave it; it doesn't need to track the docs.

## Run locally

```bash
cd web
cp .env.local.example .env.local   # Privy + devnet RPC
bun install
bun run check-env
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Required `NEXT_PUBLIC_*` vars are validated by `bun run check-env`; setup details in [docs/PRIVY_SETUP.md](docs/PRIVY_SETUP.md).

## Scripts

| Command             | Purpose          |
| ------------------- | ---------------- |
| `bun run dev`       | Dev server       |
| `bun run build`     | Production build |
| `bun run typecheck` | `tsc --noEmit`   |
| `bun run check-env` | Validate env     |

## Writing UI copy

- Use **stablecoin / USDC** language in user-facing copy, even where the mock's field names still say `pusd`. The asset is USDC (see [`docs/protocol.md`](../docs/protocol.md)) — do not write "OPAL", "PUSD", or "any USD-pegged stablecoin" into UI text.
- Keep landing/marketing copy architecture-first: explain Opal as default-true statements, economically incentivized disputes, and final settlement only at `Resolved`. Don't reintroduce placeholder marketing text that conflicts with the resolution flow.
- When copy needs to describe how resolution actually works, cross-check the root [`/docs`](../docs/) rather than writing it from memory — that's the drift this consolidation removes.
