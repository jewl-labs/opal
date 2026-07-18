import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import Navbar from '@/components/common/navbar';
import { Providers } from '@/providers/providers';

import { GeistMono, GeistPixelSquare, GeistSans } from './font';
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
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable} ${GeistSans.className} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="relative overflow-x-clip">
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
