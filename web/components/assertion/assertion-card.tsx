'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { motion as m } from 'motion/react';

import { getTimeRemaining } from '@/lib/helpers';
import type { AssertionAccount } from '@/types';

export default function AssertionCard({ data }: { data: AssertionAccount }) {
  const [remainingTime, setRemainingTime] = useState(() =>
    getTimeRemaining(data.livenessDeadline)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime(getTimeRemaining(data.livenessDeadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [data.livenessDeadline]);

  return (
    <Link href={`/assertion/browse/${data.id}`}>
      <m.div
        layout
        layoutId={`statement-card-${data.id}`}
        className="bg-muted/10 hover:bg-muted/50 group border-accent flex h-40 w-full cursor-pointer flex-col items-start gap-3 overflow-hidden border border-dashed p-2 shadow-sm transition-colors duration-200 ease-in-out md:flex-row md:gap-0"
      >
        <div className="min-w-0 flex-1 pr-4">
          <m.h2
            layout
            layoutId={`statement-${data.id}`}
            className="w-fit truncate text-lg font-medium tracking-tight md:text-xl"
          >
            {data.statement}
          </m.h2>

          <div className='flex flex-col gap-2 py-2'>
            <h2 className="text-xs font-medium uppercase">
              Outcome: <span className="text-primary">{data.outcome}</span>
            </h2>
            <h2 className="text-xs font-medium uppercase">
              Time Left: <span className="text-primary">{remainingTime}</span>
            </h2>
          </div>
        </div>

        <span className="rounded-md bg-orange-900/25 px-2 py-1 text-xs tracking-tighter text-orange-300">
          {data.state}
        </span>
      </m.div>
    </Link>
  );
}
