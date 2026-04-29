import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AssertionAccount } from '@/types';

export default function Timeline({ statement }: { statement: AssertionAccount | undefined }) {
  return (
    <div className="relative flex h-[80vh] w-fit flex-col py-8">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs whitespace-nowrap uppercase">
          25 Jan 2026
        </span>
        <span
          className={cn(
            'text-xs whitespace-nowrap uppercase',
            statement?.state === 'Asserted' ? 'text-primary' : undefined
          )}
        >
          ASSERTED
        </span>
        <ChevronRight className="size-3" />
        <span className="ring-secondary z-10 size-2 shrink-0 rounded-full bg-orange-400 ring-2" />
      </div>

      <svg
        width="1"
        className="mr-0.75 ml-auto flex-1"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <line
          x1="0.5"
          x2="0.5"
          y1="0"
          y2="100%"
          strokeDasharray="8 8"
          className="stroke-muted-foreground/50"
        />
      </svg>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs whitespace-nowrap uppercase">
          02 Feb 2026
        </span>
        <span className="text-xs whitespace-nowrap uppercase">RESOLVED</span>
        <ChevronRight className="size-3" />
        <span className="ring-secondary z-10 size-2 shrink-0 rounded-full bg-green-400 ring-2" />
      </div>
    </div>
  );
}
