'use client';

import Link from 'next/link';

import { useHydrated } from '@/hooks/use-hydrated';
import { cn } from '@/lib/utils';
import { useWallet } from '@/providers/wallet-context';

import { Button } from '../ui/button';

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

type NavbarAuthProps = {
  layout: 'desktop' | 'mobile';
  onClose?: () => void;
};

export function NavbarAuth({ layout, onClose }: NavbarAuthProps) {
  const hydrated = useHydrated();
  const { ready, authenticated, currentAddress, login, logout } = useWallet();
  const isMobile = layout === 'mobile';
  const btnClass = cn('uppercase', isMobile && 'w-full');
  const btnSize = isMobile ? undefined : ('sm' as const);
  const pendingWallet = authenticated && !currentAddress;

  // Destructive-tinted outline so Logout reads as red while keeping the app's
  // bordered-button language.
  const logoutClass = cn(
    btnClass,
    'border-destructive/20 bg-destructive/10 text-destructive hover:border-destructive/40 hover:bg-destructive/20 hover:text-destructive'
  );

  const signIn = () => {
    login();
    onClose?.();
  };

  const signOut = () => {
    void logout();
    onClose?.();
  };

  // SSR + first paint: static shell (matches server HTML).
  if (!hydrated) {
    return (
      <Button variant="outline" size={btnSize} className={btnClass} type="button">
        Sign in
      </Button>
    );
  }

  if (!ready || pendingWallet) {
    return (
      <Button variant="outline" size={btnSize} className={btnClass} disabled type="button">
        Loading…
      </Button>
    );
  }

  if (authenticated && currentAddress) {
    const activityBtn = (
      <Link
        href={`/u/${currentAddress}`}
        className={isMobile ? 'w-full' : undefined}
        onClick={onClose}
      >
        <Button variant="outline" size={btnSize} className={btnClass} type="button">
          Activity
        </Button>
      </Link>
    );

    if (isMobile) {
      return (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-center font-mono text-xs">
            {truncateAddress(currentAddress)}
          </span>
          {activityBtn}
          <Button variant="outline" className={logoutClass} type="button" onClick={signOut}>
            Logout
          </Button>
        </div>
      );
    }

    return (
      <>
        {activityBtn}
        <span className="text-muted-foreground font-mono text-xs">
          {truncateAddress(currentAddress)}
        </span>
        <Button
          variant="outline"
          size={btnSize}
          className={logoutClass}
          type="button"
          onClick={signOut}
        >
          Logout
        </Button>
      </>
    );
  }

  return (
    <Button variant="outline" size={btnSize} className={btnClass} type="button" onClick={signIn}>
      Sign in
    </Button>
  );
}
