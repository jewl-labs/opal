'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { type ReactNode } from 'react';

import { ListIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { AnimatePresence } from 'motion/react';

import { cn } from '@/lib/utils';

import { Button } from '../ui/button';
import { Kbd } from '../ui/kbd';
import NavbarMobile from './mobile-navbar';
import { NavbarAuth } from './navbar-auth';
import { SearchDialog } from './search-dialog';

// Landing keeps the max-width frame with dashed verticals; every other route
// runs the navbar full-bleed. One persistent element whose max-width animates
// and whose dashed verticals fade, so route changes glide instead of snapping.
function NavbarFrame({ isLanding, children }: { isLanding: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'relative mx-auto flex h-16 items-center justify-between border-x border-dashed px-4',
        'transition-[max-width,border-color] duration-500 ease-in-out motion-reduce:transition-none',
        isLanding ? 'border-muted-foreground/50 max-w-400' : 'max-w-[100vw] border-transparent'
      )}
    >
      {children}
    </div>
  );
}

export default function Navbar() {
  const [isMobileNavbarOpen, setIsMobileNavbarOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  // The max-width frame with dashed verticals is a landing-page-only device;
  // every other route runs the navbar full-bleed.
  const isLanding = usePathname() === '/';

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

  return (
    <>
      <div className="bg-background/85 fixed inset-x-0 top-0 z-30 overflow-x-clip backdrop-blur-md">
        <NavbarFrame isLanding={isLanding}>
          <Link href="/" className="flex items-center gap-0.5">
            <span className="relative size-10 -translate-y-0.75 overflow-hidden">
              <Image
                src="/img/logo.svg"
                fill
                priority
                alt="Opal Logo"
                className="scale-175 object-cover"
              />
            </span>
            <span className="font-heading text-lg uppercase">Opal</span>
          </Link>
          <div className="hidden items-center gap-4 md:flex">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50 group flex h-9 w-64 cursor-pointer items-center gap-2.5 border px-3 transition-colors"
            >
              <MagnifyingGlassIcon className="text-muted-foreground/50 group-hover:text-muted-foreground size-4 shrink-0 transition-colors" />
              <span className="text-muted-foreground/70 group-hover:text-muted-foreground font-mono text-xs tracking-widest uppercase transition-colors">
                Find Account
              </span>
              <Kbd className="ml-auto">⌘K</Kbd>
            </button>
            <NavbarAuth layout="desktop" />
          </div>
          <div className="flex md:hidden">
            <Button
              onClick={() => setIsMobileNavbarOpen(!isMobileNavbarOpen)}
              size="icon-lg"
              variant="outline"
              type="button"
            >
              {isMobileNavbarOpen ? <XIcon /> : <ListIcon />}
            </Button>
          </div>
        </NavbarFrame>
        <span
          className={cn(
            'absolute right-0 bottom-0 left-0 h-0.5 border-b',
            isLanding ? 'border-muted-foreground/50 border-dashed' : 'border-border'
          )}
        />
        <AnimatePresence mode="wait">
          {isMobileNavbarOpen && <NavbarMobile onClose={() => setIsMobileNavbarOpen(false)} />}
        </AnimatePresence>
      </div>
      {/* Outside the blurred header: backdrop-filter creates a containing block,
        which would trap this fixed-position dialog inside the 64px navbar. */}
      <SearchDialog isOpen={isSearchOpen} onClose={handleCloseSearch} />
    </>
  );
}
