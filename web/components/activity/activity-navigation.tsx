'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  CurrencyDollarIcon,
  FilePlusIcon,
  GavelIcon,
  GridFourIcon,
  WarningOctagonIcon,
} from '@phosphor-icons/react';
import { CheckIcon, CopySimpleIcon } from '@phosphor-icons/react';
import { motion as m } from 'motion/react';

import { Button } from '../ui/button';

const LINKS = [
  {
    label: 'Overview',
    path: '',
    icon: GridFourIcon,
  },
  {
    label: 'Assertions',
    path: 'assertions',
    icon: FilePlusIcon,
  },
  {
    label: 'Disputes',
    path: 'disputes',
    icon: WarningOctagonIcon,
  },
  {
    label: 'Votes',
    path: 'votes',
    icon: GavelIcon,
  },
  {
    label: 'Earnings',
    path: 'earnings',
    icon: CurrencyDollarIcon,
  },
];

export default function ActivityNavigation() {
  const pathname = usePathname();
  const params = useParams();
  const addressParam = params?.address;
  const address = Array.isArray(addressParam) ? addressParam[0] : addressParam;
  const basePath = address ? `/u/${address}` : '/u';
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [isCopied]);

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setIsCopied(true);
    } catch {
      // Clipboard unavailable (permissions / insecure context) — leave the icon unchanged.
      setIsCopied(false);
    }
  };

  const trimmedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  return (
    <div className="bg-background border-border sticky top-16 z-20 border-b">
      <div className="scrollbar-thumb-muted-foreground/20 flex w-full scrollbar-thin scrollbar-track-transparent items-center justify-between overflow-x-auto">
        <div className="flex w-max snap-x snap-mandatory gap-2 px-4 py-3 md:w-fit">
          {LINKS.map(({ label, path, icon: Icon }) => {
            const href = path ? `${basePath}/${path}` : basePath;
            const isActive = pathname === href || (path !== '' && pathname?.startsWith(href));
            return (
              <Link
                href={href}
                key={href}
                aria-current={isActive ? 'page' : undefined}
                className={
                  `relative flex snap-center flex-col items-center justify-center gap-1 rounded-none px-3 py-1.5 whitespace-nowrap transition-colors duration-150 md:flex-row md:gap-2 ` +
                  (isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:bg-muted-foreground/5 hover:text-foreground')
                }
              >
                {isActive && (
                  <m.span
                    layoutId="activity-tab-indicator"
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-primary/10 ring-primary/10 absolute inset-0 ring-1"
                  />
                )}
                <Icon className="relative z-10 size-4" />
                <span className="relative z-10 font-mono text-xs tracking-widest uppercase">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="flex items-center px-4">
          <span className="text-muted-foreground font-mono text-xs tracking-widest">
            {trimmedAddress}
          </span>
          <Button variant="ghost" size="icon-sm" className="ml-2" onClick={handleCopy}>
            {isCopied ? <CheckIcon weight="bold" /> : <CopySimpleIcon weight="bold" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
