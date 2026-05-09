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

import Container from '../common/container';
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

  // !TBD: Add error handling for clipboard API failures
  const handleCopy = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setIsCopied(true);
    }
  };

  const trimmedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  return (
    <Container className="bg-background border-muted-foreground/50 sticky top-16 z-0 border-b border-dashed">
      <div className="scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent flex w-full items-center justify-between overflow-x-auto">
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
                  `flex snap-center flex-col items-center justify-center gap-1 rounded-md px-3 py-1.5 whitespace-nowrap transition-colors duration-150 md:flex-row md:gap-2 ` +
                  (isActive
                    ? 'text-primary bg-primary/10 ring-primary/10 ring-1'
                    : 'text-foreground/90 hover:bg-muted-foreground/5')
                }
              >
                <Icon className="size-4" />
                <span className="text-xs md:text-sm">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="px-4">
          <span>{trimmedAddress}</span>
          <Button variant="ghost" size="icon-sm" className="ml-2" onClick={handleCopy}>
            {isCopied ? <CheckIcon weight="bold" /> : <CopySimpleIcon weight="bold" />}
          </Button>
        </div>
      </div>
    </Container>
  );
}
