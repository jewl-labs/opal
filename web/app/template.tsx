'use client';

import { usePathname } from 'next/navigation';

import { motion as m } from 'motion/react';

// Remounts per navigation (Next template convention); the pathname key additionally
// forces the enter animation to replay on every route change.
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <m.div
      key={pathname}
      initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
