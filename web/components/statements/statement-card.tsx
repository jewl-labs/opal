'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { TimerIcon } from 'lucide-react';
import { motion as m } from 'motion/react';

import { getTimeRemaining } from '@/lib/helpers';
import type { AssertionAccount } from '@/types';

export default function StatementCard(data: AssertionAccount) {
  const [remainingTime, setRemainingTime] = useState(() =>
    getTimeRemaining(data?.livenessDeadline)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime(getTimeRemaining(data?.livenessDeadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [data?.livenessDeadline]);

  return (
    <Link href={`/statement/browse/${data.id}`}>
      <m.div
        layout
        layoutId={`statement-card-${data.id}`}
        className="bg-muted/10 hover:bg-muted/50 group border-accent flex w-full cursor-pointer flex-col items-start gap-3 overflow-hidden border border-dashed p-2 md:h-28 shadow-sm transition-colors duration-200 ease-in-out md:flex-row md:gap-0"
      >
        <div className="min-w-0 flex-1">
          <m.h2
            layout
            layoutId={`statement-${data.id}`}
            className="w-fit text-lg font-semibold tracking-tighter wrap-break-word whitespace-normal md:text-2xl"
          >
            {data.statement}
          </m.h2>

          <div className="text-muted-foreground/70 mt-2 flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <TimerIcon size={14} />
              <span className="font-medium">{remainingTime}</span>
            </div>
            <div className="hidden sm:block">|</div>
            <div className="text-primary">{data.bondAmountPUSD} OPAL</div>
          </div>
        </div>

        <span className="rounded-md bg-orange-900/25 px-2 py-1 text-xs tracking-tighter text-orange-300 uppercase">
          {data.state}
        </span>
      </m.div>
    </Link>
  );
}
