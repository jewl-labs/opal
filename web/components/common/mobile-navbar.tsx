'use client';

import Link from 'next/link';

import { motion as m } from 'motion/react';

import { useWallet } from '@/providers/wallet-context';

import { Button } from '../ui/button';

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

const containerVariants = {
  hidden: {
    opacity: 0,
    y: -32,
    scale: 0.98,
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 320,
      damping: 28,
      duration: 0.32,
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    y: -32,
    scale: 0.98,
    transition: {
      staggerChildren: 0.04,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: -8,
  },
  show: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -8,
  },
};

export default function NavbarMobile({ onClose }: { onClose: () => void }) {
  const { ready, authenticated, currentAddress, login, logout } = useWallet();

  const handleSignIn = () => {
    login();
    onClose();
  };

  const handleLogout = () => {
    void logout();
    onClose();
  };

  return (
    <m.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="bg-background fixed inset-x-0 top-16 z-10 flex flex-col gap-4 border-x border-b border-dashed p-8 shadow-lg"
    >
      <m.div variants={itemVariants}>
        {!ready ? (
          <Button variant="outline" className="w-full uppercase" disabled>
            Loading…
          </Button>
        ) : authenticated && currentAddress ? (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-center font-mono text-xs">
              {truncateAddress(currentAddress)}
            </span>
            <Link href={`/u/${currentAddress}`} className="w-full" onClick={onClose}>
              <Button variant="outline" className="w-full uppercase">
                Activity
              </Button>
            </Link>
            <Button variant="outline" className="w-full uppercase" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full uppercase" onClick={handleSignIn}>
            Sign in
          </Button>
        )}
      </m.div>
      <m.div variants={itemVariants} className="w-full">
        <Link href="/" className="w-full" onClick={onClose}>
          <Button variant="outline" className="w-full uppercase">
            Dashboard
          </Button>
        </Link>
      </m.div>
      <m.div variants={itemVariants} className="w-full">
        <Link href="/assertion/browse" className="w-full" onClick={onClose}>
          <Button variant="outline" className="w-full uppercase">
            Explore Feed
          </Button>
        </Link>
      </m.div>
      <m.div variants={itemVariants} className="w-full">
        <Link href="/assertion/make" className="w-full" onClick={onClose}>
          <Button variant="outline" className="w-full uppercase">
            Assert Statement
          </Button>
        </Link>
      </m.div>
    </m.div>
  );
}
