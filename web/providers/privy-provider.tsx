'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

import { getEnv } from '@/lib/env';

export function OpalPrivyProvider({ children }: { children: React.ReactNode }) {
  const env = getEnv();

  return (
    <PrivyProvider
      appId={env.privyAppId}
      clientId={env.privyClientId}
      config={{
        loginMethods: ['google', 'twitter', 'github'],
        appearance: {
          theme: 'dark',
          walletChainType: 'solana-only',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          solana: { createOnLogin: 'all-users' },
        },
        solana: {
          rpcs: {
            [env.privySolanaChain]: {
              rpc: createSolanaRpc(env.solanaRpcUrl),
              rpcSubscriptions: createSolanaRpcSubscriptions(env.solanaRpcWss),
            },
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
