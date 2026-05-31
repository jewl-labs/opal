# Opal web

Next.js frontend for Opal. **Privy** provides social login and an embedded Solana wallet on **Solana devnet** (no localnet mode). Assertion browse/make flows still use **mock data** (`data/assertion.ts`) for listings and submit navigation until Anchor client integration lands.

**Note:** `@privy-io/react-auth` is mounted in the root layout, so production builds compile a large wallet/auth dependency tree (expect multi-minute `bun run build` on cold cache).

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

Setup details: [docs/PRIVY_SETUP.md](docs/PRIVY_SETUP.md).
