# Privy setup (Phase 1.1)

Opal web always talks to **Solana devnet**, including when you run `next dev` on localhost. There is no localnet mode in the frontend.

**Also read:** [web/README.md](../README.md) (env, dev server).

## Dashboard vs SDK `loginMethods`

| Layer                              | What it does                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Privy Dashboard**                | Enables OAuth apps / credentials per provider (Google, GitHub, etc.). Disables wallet SIWE/SIWS if you turn off wallet login there.                                      |
| **`PrivyProvider` `loginMethods`** | Controls what the **login modal** shows when you call `login()`. **Required** — Privy SDK needs at least one method; should **match** what you enabled in the dashboard. |

Dashboard alone is not enough: the SDK will not infer your login UI from dashboard settings. We set explicitly:

```ts
loginMethods: ['google', 'twitter', 'github'],
```

**Social only (no Phantom / WalletConnect):**

1. Dashboard → disable **Wallet login** (SIWE / SIWS).
2. SDK → `loginMethods` as above (no `'wallet'`).
3. UI → only `login()` / “Sign in”, never `connectWallet()` or `linkWallet()`.
4. Embedded Solana wallet is still created **after** social login (invisible to user as “connect wallet”).

## Environment

```bash
cd web
cp .env.local.example .env.local
bun run check-env
```

## Dashboard checklist

- [ ] Socials: Google, Twitter/X, GitHub enabled
- [ ] Wallet login: **disabled**
- [ ] Embedded wallets: Solana, create on login
- [ ] App client allowed origin: `http://localhost:3000`
- [ ] App Secret not in `NEXT_PUBLIC_*` vars

## Assertion make flow

`/assertion/make` uses Privy for the primary CTA: when the wallet is not connected, **Stake / Assert** stays clickable and calls `login()` (`Sign in to Assert`). After sign-in, the same button requires a valid statement (≥10 chars, not ending in `?`) before mock submit navigates to browse.
