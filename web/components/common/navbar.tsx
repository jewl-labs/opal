'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ListIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { AnimatePresence } from 'motion/react';

import { useWallet } from '@/providers/wallet-context';

import Container from '../common/container';
import { Button } from '../ui/button';
import { InputGroup } from '../ui/input-group';
import CornerMarker from './corner-marker';
import NavbarMobile from './mobile-navbar';
import { SearchDialog } from './search-dialog';

export default function Navbar() {
  const [isMobileNavbarOpen, setIsMobileNavbarOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const { currentAddress } = useWallet();

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

  return (
    <div className="bg-background fixed inset-x-0 top-0 z-30 overflow-x-clip">
      <Container className="border-muted-foreground/50 relative flex h-16 items-center justify-between border-x border-dashed px-4">
        <Link href="/">
          <h1 className="text-xl font-semibold tracking-tight uppercase">Opal</h1>
        </Link>
        <div className="hidden items-center gap-4 md:flex">
          <Button
            type="button"
            variant="outline"
            className="flex w-60 items-center justify-between"
            size="md"
            onClick={() => setIsSearchOpen(true)}
          >
            <span>Search</span>
            <kbd className="bg-muted rounded px-2 py-1 text-xs font-semibold">⌘ + K</kbd>
          </Button>
          {currentAddress ? (
            <Link href={`/u/${currentAddress}`}>
              <Button variant="outline" size="md">
                Activity
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="md" disabled>
              Activity
            </Button>
          )}
          <Button variant="outline" size="md">
            Connect Wallet
          </Button>
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
        <CornerMarker position="bottom" />
      </Container>
      <span className="border-muted-foreground/50 absolute right-0 bottom-0 left-0 h-0.5 border-b border-dashed" />
      <AnimatePresence mode="wait">{isMobileNavbarOpen && <NavbarMobile />}</AnimatePresence>
      <SearchDialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
