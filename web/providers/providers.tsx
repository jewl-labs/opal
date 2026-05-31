'use client';

import type { ReactNode } from 'react';

import { OpalPrivyProvider } from '@/providers/privy-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { WalletProvider } from '@/providers/wallet-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <OpalPrivyProvider>
        <WalletProvider>{children}</WalletProvider>
      </OpalPrivyProvider>
    </ThemeProvider>
  );
}
