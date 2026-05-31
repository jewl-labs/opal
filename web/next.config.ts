import type { NextConfig } from 'next';

import path from 'path';

const requiredPublicEnv = ['NEXT_PUBLIC_PRIVY_APP_ID', 'NEXT_PUBLIC_SOLANA_RPC_URL'] as const;

for (const key of requiredPublicEnv) {
  if (!process.env[key]) {
    console.warn(`[opal/web] Missing ${key}. Copy .env.local.example → .env.local`);
  }
}

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, '.'),
  },
};

export default nextConfig;
