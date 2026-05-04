'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

// Hardcoded default address
const DEFAULT_WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f42bE2';

interface WalletContextType {
  currentAddress: string;
  setCurrentAddress: (address: string) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [currentAddress, setCurrentAddress] = useState(DEFAULT_WALLET_ADDRESS);

  return (
    <WalletContext.Provider value={{ currentAddress, setCurrentAddress }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
