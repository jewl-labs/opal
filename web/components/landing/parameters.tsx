'use client';
import { Fragment } from 'react';

import { motion as m } from 'motion/react';

// Protocol facts as a single quiet strip at the bottom of the hero.
const PARAMETERS = [
  { value: '3', label: 'Terminal outcomes' },
  { value: '2', label: 'Dispute layers' },
  { value: 'USDC', label: 'Single asset' },
  { value: '1 = 1', label: 'Vote weight' },
  { value: '67%', label: 'Supermajority' },
];

export function ParametersRow() {
  return (
    <m.div
      initial={{ opacity: 0, filter: 'blur(6px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, delay: 0.9 }}
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-5 font-mono text-[11px] tracking-[0.18em] uppercase"
    >
      {PARAMETERS.map((param, index) => (
        <Fragment key={param.label}>
          {index > 0 && <span className="text-muted-foreground/30 select-none">·</span>}

          <span className="text-muted-foreground whitespace-nowrap">
            <span className="text-primary mr-2 tabular-nums">{param.value}</span>
            {param.label}
          </span>
        </Fragment>
      ))}
    </m.div>
  );
}
