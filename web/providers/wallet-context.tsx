'use client';

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import { useLogin, usePrivy } from '@privy-io/react-auth';
import {
  type ConnectedStandardSolanaWallet,
  useCreateWallet,
  useWallets,
} from '@privy-io/react-auth/solana';

interface WalletContextType {
  ready: boolean;
  authenticated: boolean;
  currentAddress: string | null;
  embeddedWallet: ConnectedStandardSolanaWallet | null;
  login: () => void;
  logout: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function findPrivyWallet(wallets: ConnectedStandardSolanaWallet[]) {
  return wallets.find((wallet) => wallet.standardWallet.name === 'Privy') ?? null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { ready: privyReady, authenticated, logout } = usePrivy();
  const { ready: solanaWalletsReady, wallets } = useWallets();
  const { createWallet } = useCreateWallet();

  const embeddedWallet = useMemo(() => findPrivyWallet(wallets), [wallets]);
  const currentAddress = embeddedWallet?.address ?? null;
  const ready = privyReady && solanaWalletsReady;

  const ensureEmbeddedWallet = useCallback(async () => {
    if (!authenticated || embeddedWallet) return;
    try {
      await createWallet();
    } catch {
      // Wallet may already exist or user dismissed creation UI.
    }
  }, [authenticated, createWallet, embeddedWallet]);

  const { login } = useLogin({
    onComplete: () => {
      void ensureEmbeddedWallet();
    },
  });

  useEffect(() => {
    if (!ready || !authenticated) return;
    void ensureEmbeddedWallet();
  }, [authenticated, ensureEmbeddedWallet, ready]);

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      currentAddress,
      embeddedWallet,
      login,
      logout,
    }),
    [authenticated, currentAddress, embeddedWallet, login, logout, ready]
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
