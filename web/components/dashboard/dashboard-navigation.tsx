'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  CircleDollarSignIcon,
  FilePlusCornerIcon,
  GavelIcon,
  Grid2x2Icon,
  OctagonAlertIcon,
} from 'lucide-react';

import Container from '../common/container';

const LINKS = [
  {
    label: 'Overview',
    href: '/dashboard',
    icon: Grid2x2Icon,
  },
  {
    label: 'My Claims',
    href: '/dashboard/claims',
    icon: FilePlusCornerIcon,
  },
  {
    label: 'My Disputes',
    href: '/dashboard/disputes',
    icon: OctagonAlertIcon,
  },
  {
    label: 'Active Votes',
    href: '/dashboard/votes',
    icon: GavelIcon,
  },
  {
    label: 'Earnings',
    href: '/dashboard/earnings',
    icon: CircleDollarSignIcon,
  },
];

export default function DashboardNavigation() {
  const pathname = usePathname();

  return (
    <Container className="bg-background border-muted-foreground/50 sticky top-16 z-0 border-b border-dashed">
      <div className="scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent w-full overflow-x-auto">
        <div className="flex w-max snap-x snap-mandatory gap-2 px-4 py-3 md:w-full md:justify-center">
          {LINKS.map(({ label, href, icon: Icon }) => {
            const isActive =
              pathname === href || (href !== '/dashboard' && pathname?.startsWith(href));
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
      </div>
    </Container>
  );
}
