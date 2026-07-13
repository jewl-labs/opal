# Auth & wallet

Auth is **Privy social login** with an **auto-created Solana devnet embedded wallet**.
The wallet provides identity/address only — no app code signs or sends transactions with
it yet. See also `web/docs/PRIVY_SETUP.md` for the dashboard checklist.

## Provider composition — `providers/providers.tsx`

```
ThemeProvider (next-themes)
  └─ OpalPrivyProvider (privy)
       └─ WalletProvider (custom context)
            └─ {app}
```

### `providers/privy-provider.tsx` — `OpalPrivyProvider` (client)

- `PrivyProvider` from `@privy-io/react-auth`, config from `getEnv()`.
- `appId` / `clientId` from env.
- `loginMethods: ['google', 'twitter', 'github']` — **social only**, no wallet SIWS.
- `appearance`: dark theme, `walletChainType: 'solana-only'`, `showWalletLoginFirst: false`.
- `embeddedWallets.solana.createOnLogin: 'all-users'` — auto-provisions a Solana wallet.
- `solana.rpcs['solana:devnet'] = { rpc: createSolanaRpc(url), rpcSubscriptions: createSolanaRpcSubscriptions(wss) }`.
  ⚠️ **This is the only place a real Solana RPC object is constructed, and it is passed
  solely to Privy's embedded-wallet infra.** App code never reads/writes chain state
  through it.

### `providers/wallet-context.tsx` — `WalletProvider` + `useWallet()` (client)

Combines `usePrivy()`, `useWallets()` (`@privy-io/react-auth/solana`), and `useLogin()`.
Exposes a memoized value:

```ts
useWallet(): {
  ready: boolean;          // privyReady && solanaWalletsReady
  authenticated: boolean;
  currentAddress: string | null; // address of the wallet whose standardWallet.name === 'Privy'
  login: () => void;
  logout: () => void;
}
```

`useWallet()` throws if used outside `WalletProvider`. This is the hook every component
should use for auth/address — do not reach into Privy directly.

## Hydration — `hooks/use-hydrated.ts`

`useHydrated()` uses `useSyncExternalStore` (no-op subscribe, server snapshot `false`,
client snapshot `true`). Returns `false` during SSR, `true` after hydration. Use it to
gate auth-dependent UI and avoid Privy hydration mismatches (see `navbar-auth.tsx`).

## Environment — `lib/env.ts`, `next.config.ts`, `scripts/check-env.ts`

Required / recognized `NEXT_PUBLIC_*` vars:

| Var                           | Required                               | Notes                                                  |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_PRIVY_APP_ID`    | ✅ (throws if missing)                 | Privy app id                                           |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | optional in code, needed for localhost | per check-env warning                                  |
| `NEXT_PUBLIC_SOLANA_RPC_URL`  | ✅                                     | devnet https RPC                                       |
| `NEXT_PUBLIC_SOLANA_RPC_WSS`  | ✅                                     | devnet wss (use provider's real wss, don't guess)      |
| `NEXT_PUBLIC_SOLANA_CLUSTER`  | optional, default `devnet`             | **any value other than `devnet` throws** — devnet only |
| `PRIVY_APP_SECRET`            | must NOT be public/client-imported     | guarded against; only for future server API routes     |

- `getEnv()` reads/validates these; `privySolanaChain` is the literal `'solana:devnet'`.
- `next.config.ts` warns at build if the three required public vars are missing; also sets
  Turbopack root to the `web` dir.
- `bun run check-env` prints masked ids + RPC config and enforces the devnet constraint.

## Integration note

When transaction submission lands, the embedded Solana wallet from Privy is the signer.
Fetch it via the Privy Solana hooks (as `wallet-context.tsx` already does for
`currentAddress`), build transactions against the same devnet RPC, and sign/send through
the Privy wallet.
