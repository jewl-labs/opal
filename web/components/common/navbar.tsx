'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ListIcon, XIcon } from '@phosphor-icons/react';
import { AnimatePresence } from 'motion/react';

import { useWallet } from '@/providers/wallet-context';

import Container from '../common/container';
import { Button } from '../ui/button';
import NavbarMobile from './mobile-navbar';
import { SearchDialog } from './search-dialog';

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function Navbar() {
  const [isMobileNavbarOpen, setIsMobileNavbarOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const { ready, authenticated, currentAddress, login, logout } = useWallet();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCloseSearch = useCallback(() => setIsSearchOpen(false), []);

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

  return (
    <div className="bg-background fixed inset-x-0 top-0 z-30 overflow-x-clip">
      <Container className="border-muted-foreground/50 relative flex h-16 items-center justify-between border-x border-dashed px-4">
        <Link href="/">
          <span className="text-xl font-semibold tracking-tight uppercase">Opal</span>
        </Link>
        <div className="hidden items-center gap-4 md:flex">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSearchOpen(true)}
            className="w-64 justify-between px-3"
          >
            <div className="text-muted-foreground text-xs">Search</div>
            <kbd className="bg-muted rounded text-xs font-semibold">⌘ + K</kbd>
          </Button>
          {authenticated && currentAddress && (
            <Link href={`/u/${currentAddress}`}>
              <Button variant="outline" size="sm">
                Activity
              </Button>
            </Link>
          )}
          {!ready ? (
            <Button variant="outline" size="sm" disabled>
              Loading…
            </Button>
          ) : authenticated && currentAddress ? (
            <>
              <span className="text-muted-foreground font-mono text-xs">
                {truncateAddress(currentAddress)}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={login}>
              Sign in
            </Button>
          )}
        </div>
        <div className="flex md:hidden">
          <Button
            onClick={() => setIsMobileNavbarOpen(!isMobileNavbarOpen)}
            size="icon-lg"
            variant="outline"
          >
            {isMobileNavbarOpen ? <XIcon /> : <ListIcon />}
          </Button>
        </div>
      </Container>
      <span className="border-muted-foreground/50 absolute right-0 bottom-0 left-0 h-0.5 border-b border-dashed" />
      <AnimatePresence mode="wait">
        {isMobileNavbarOpen && <NavbarMobile onClose={() => setIsMobileNavbarOpen(false)} />}
      </AnimatePresence>
      <SearchDialog isOpen={isSearchOpen} onClose={handleCloseSearch} />
    </div>
  );
}
