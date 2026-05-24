/**
 * Public client/server config from NEXT_PUBLIC_* env vars.
 * Never add PRIVY_APP_SECRET or other secrets here.
 *
 * Opal web targets devnet only (local dev runs against devnet RPC + deployed program).
 *
 * Use static `process.env.NEXT_PUBLIC_*` access only — Next.js inlines these for
 * client bundles; dynamic `process.env[name]` is undefined in the browser.
 */
function requirePublicEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy web/.env.local.example to web/.env.local and fill in values from the Privy dashboard.`
    );
  }
  return value;
}

export type Env = {
  readonly privyAppId: string;
  readonly privyClientId: string | undefined;
  readonly solanaRpcUrl: string;
  readonly solanaRpcWss: string;
  readonly privySolanaChain: 'solana:devnet';
  readonly opalProgramId: string;
};

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? 'devnet';
  if (cluster !== 'devnet') {
    throw new Error(
      `NEXT_PUBLIC_SOLANA_CLUSTER must be "devnet". Got "${cluster}". Opal web does not target localnet.`
    );
  }

  const solanaRpcUrl = requirePublicEnv(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    'NEXT_PUBLIC_SOLANA_RPC_URL'
  );

  cached = {
    privyAppId: requirePublicEnv(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID,
      'NEXT_PUBLIC_PRIVY_APP_ID'
    ),
    privyClientId: process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID,
    solanaRpcUrl,
    solanaRpcWss:
      process.env.NEXT_PUBLIC_SOLANA_RPC_WSS ??
      solanaRpcUrl.replace(/^https:/, 'wss:'),
    privySolanaChain: 'solana:devnet',
    opalProgramId: requirePublicEnv(
      process.env.NEXT_PUBLIC_OPAL_PROGRAM_ID,
      'NEXT_PUBLIC_OPAL_PROGRAM_ID'
    ),
  };
  return cached;
}
