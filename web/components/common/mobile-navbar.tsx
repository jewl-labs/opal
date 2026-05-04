import Link from 'next/link';

import { motion as m } from 'motion/react';

import { Button } from '../ui/button';

export default function NavbarMobile() {
  return (
    <m.div
      initial={{
        opacity: 0,
        y: -32,
        scale: 0.98,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        y: -32,
        scale: 0.98,
      }}
      transition={{
        type: 'spring',
        stiffness: 320,
        damping: 28,
        duration: 0.32,
      }}
      className="bg-background fixed inset-x-0 top-16 z-10 flex flex-col gap-4 border-x border-b border-dashed p-8 shadow-lg"
    >
      <Button variant="outline" className="uppercase">Connect Wallet</Button>
      <Link href="/dashboard" className="w-full">
        <Button variant="outline" className="w-full uppercase">
          Dashboard
        </Button>
      </Link>
      <Link href="/assertion/browse" className="w-full">
        <Button variant="outline" className="w-full uppercase">
          Explore Feed
        </Button>
      </Link>
      <Link href="/assertion/create" className="w-full">
        <Button variant="outline" className="w-full uppercase">
          Assert Statement
        </Button>
      </Link>
    </m.div>
  );
}
