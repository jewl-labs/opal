import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import Container from '@/components/common/container';
import Navbar from '@/components/common/navbar';
import { Providers } from '@/providers/providers';

import { Disket } from './font';
import './globals.css';

export const metadata: Metadata = {
  title: 'OPAL',
  description:
    'A Solana-native optimistic oracle for natural-language statements. Assertions default to true until disputed, then resolve through LLM and private voting layers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${Disket.className} h-full antialiased`} suppressHydrationWarning>
      <body className="relative overflow-x-clip">
        <Providers>
          <Container className="border-muted-foreground/50 border-x border-dashed">
            <Navbar />
          </Container>
          {children}
        </Providers>
      </body>
    </html>
  );
}
