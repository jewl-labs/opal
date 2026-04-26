'use client';

import { motion as m } from 'motion/react';
import { TimerIcon } from 'lucide-react';

export type StatementStatus = 'proposed' | 'voting' | 'resolved';

export interface StatementCardProps {
  id: string;
  statement: string;
  status: string;
  bond: number;
  dispute: {
    window: number;
    count: number;
  };
}

export default function StatemenrCard(data: StatementCardProps) {
  return (
    <a href={`/statement/feed/${data.id}`}>
      <m.div
        layout
        layoutId={`statement-card-${data.id}`}
        className="bg-muted/30 hover:bg-muted/55 group border-accent flex md:h-36 w-full cursor-pointer justify-between border border-dashed p-4 shadow-2xs transition-colors duration-300 ease-in-out"
      >
        <div className="flex flex-col">
          <m.h2
            layout
            layoutId={`statement-${data.id}`}
            className="text-2xl font-semibold tracking-tight"
          >
            {data.statement}
          </m.h2>
          <h2>
            Bond: <span>{data.bond} OPAL</span>
          </h2>
          <div className="flex items-center gap-1">
            <TimerIcon className="size-4" />
            <span className="font-medium">{data.dispute.window}Hr</span>
          </div>
        </div>
        <div className="flex w-fit flex-col items-end justify-between">
          <span className="bg-orange-900/25 px-2 py-1 text-xs tracking-tighter text-orange-300 uppercase shadow-2xl">
            {data.status}
          </span>
        </div>
      </m.div>
    </a>
  );
}
