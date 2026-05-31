'use client';

import { type ReactNode, createContext, useContext, useMemo } from 'react';

import { useLogin, usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';

interface WalletContextType {
  ready: boolean;
  authenticated: boolean;
  currentAddress: string | null;
  login: () => void;
  logout: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { ready: privyReady, authenticated, logout } = usePrivy();
  const { ready: solanaWalletsReady, wallets } = useWallets();
  const { login } = useLogin();

  const currentAddress =
    wallets.find((wallet) => wallet.standardWallet.name === 'Privy')?.address ?? null;
  const ready = privyReady && solanaWalletsReady;

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      currentAddress,
      login,
      logout,
    }),
    [authenticated, currentAddress, login, logout, ready]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
