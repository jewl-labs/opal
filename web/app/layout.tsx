import type { Metadata } from 'next';

import Container from '@/components/common/container';
import Navbar from '@/components/common/navbar';
import { ThemeProvider } from '@/providers/theme-provider';

import { jetbrains } from './font';
import './globals.css';

export const metadata: Metadata = {
  title: 'OPAL',
  description: '',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetbrains.className} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="relative overflow-x-clip">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Container className="border-muted-foreground/50 border-x border-dashed">
            <Navbar />
          </Container>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
