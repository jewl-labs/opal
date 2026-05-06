'use client';

import { ReactNode, createContext, useContext, useState } from 'react';

import { MOCK_WALLET_ADDRESS } from '@/data/wallet';

interface WalletContextType {
  currentAddress: string;
  setCurrentAddress: (address: string) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function isValidAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  return trimmed.length >= 32 && trimmed.length <= 50;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [currentAddress, setCurrentAddress] = useState(MOCK_WALLET_ADDRESS);

  const setValidatedAddress = (address: string) => {
    const trimmed = address.trim();
    if (isValidAddress(trimmed)) {
      setCurrentAddress(trimmed);
    } else {
      setCurrentAddress(MOCK_WALLET_ADDRESS);
    }
  };

  const setValidatedAddress = (address: string) => {
    const trimmed = address.trim();
    if (isValidAddress(trimmed)) {
      setCurrentAddress(trimmed);
    } else {
      setCurrentAddress(DEFAULT_WALLET_ADDRESS);
    }
  };

  return (
    <WalletContext.Provider value={{ currentAddress, setCurrentAddress: setValidatedAddress }}>
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
