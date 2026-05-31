# Opal web

Next.js frontend for Opal. **Privy** provides social login and an embedded Solana wallet on devnet. Assertion flows use **mock data** (`data/assertion.ts`) until on-chain integration is added.

## Run locally

```bash
cd web
cp .env.local.example .env.local   # Privy + devnet RPC
bun install
bun run check-env
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

See [docs/PRIVY_SETUP.md](docs/PRIVY_SETUP.md). Required `NEXT_PUBLIC_*` vars are validated by `bun run check-env`.

## Scripts

| Command             | Purpose          |
| ------------------- | ---------------- |
| `bun run dev`       | Dev server       |
| `bun run build`     | Production build |
| `bun run typecheck` | `tsc --noEmit`   |
| `bun run check-env` | Validate env     |

Privy integration plan: [`../plan.md`](../plan.md).
