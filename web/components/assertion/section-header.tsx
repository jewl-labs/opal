import type * as React from 'react';

import { m } from 'motion/react';
import { CaretDownIcon } from '@phosphor-icons/react';

export default function SectionHeader({
  label,
  open,
  onClick,
  peek,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
  peek?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="border-muted-foreground/50 flex w-full items-center justify-between border-t border-dashed px-6 py-4 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-3">
        <span
          className={`text-base font-medium tracking-widest uppercase transition-colors md:text-lg ${
            open ? 'text-foreground' : 'text-foreground/50'
          }`}
        >
          {label}
        </span>
        {peek && !open && (
          <m.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground/45 max-w-60 truncate text-sm md:text-base"
          >
            {peek}
          </m.span>
        )}
      </div>
      <m.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
        <CaretDownIcon className="text-muted-foreground/40 stroke-1 size-6" />
      </m.div>
    </button>
  );
}
