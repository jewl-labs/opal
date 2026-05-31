/**
 * Verifies required NEXT_PUBLIC_* vars are set (no secret values printed).
 * Run from web/: bun run scripts/check-env.ts
 */
import { getEnv } from '../lib/env';

const env = getEnv();

console.log('Environment OK');
console.log('  NEXT_PUBLIC_PRIVY_APP_ID:', mask(env.privyAppId));
if (!env.privyClientId) {
  console.warn(
    '  Warning: NEXT_PUBLIC_PRIVY_CLIENT_ID is not set. Privy app clients require it for localhost.'
  );
} else {
  console.log('  NEXT_PUBLIC_PRIVY_CLIENT_ID:', mask(env.privyClientId));
}
console.log('  NEXT_PUBLIC_SOLANA_CLUSTER: devnet (enforced)');
console.log('  NEXT_PUBLIC_SOLANA_RPC_URL:', env.solanaRpcUrl);
console.log('  NEXT_PUBLIC_SOLANA_RPC_WSS:', env.solanaRpcWss);
console.log('  Privy Solana chain id:', env.privySolanaChain);

if (process.env.PRIVY_APP_SECRET) {
  console.warn(
    '  Warning: PRIVY_APP_SECRET is set. It must not use NEXT_PUBLIC_ and must not be imported in client code.'
  );
}

function mask(value: string): string {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
