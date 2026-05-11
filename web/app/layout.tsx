import type { Metadata } from 'next';
import type * as React from 'react';

import Container from '@/components/common/container';
import Navbar from '@/components/common/navbar';
import { ThemeProvider } from '@/providers/theme-provider';
import { WalletProvider } from '@/providers/wallet-context';

import { Disket, Excon } from './font';
import './globals.css';

export const metadata: Metadata = {
  title: 'OPAL',
  description:
    'A Solana-native optimistic oracle for natural-language statements. Assertions default to true until disputed, then resolve through LLM and private voting layers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${Disket.className} h-full antialiased`} suppressHydrationWarning>
      <body className="relative overflow-x-clip">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <WalletProvider>
            <Container className="border-muted-foreground/50 border-x border-dashed">
              <Navbar />
            </Container>
            {children}
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
