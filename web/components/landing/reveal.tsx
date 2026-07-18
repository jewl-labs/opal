'use client';
import type { ReactNode } from 'react';

import { motion as m } from 'motion/react';

import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;

// Shared scroll-reveal: fade + de-blur + rise once the element enters the viewport.
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </m.div>
  );
}

// Variants for staggered children — same opacity/blur/translate language as Reveal.
export const revealItem = {
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: EASE },
  },
};

// Consistent section header: mono eyebrow, uppercase title, optional subtitle.
export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = 'center',
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  const centered = align === 'center';

  return (
    <Reveal
      className={cn(
        'flex max-w-3xl flex-col gap-4',
        centered ? 'mx-auto items-center text-center' : 'items-start text-left',
        className
      )}
    >
      <p className="text-primary font-mono text-xs tracking-[0.3em] uppercase">{eyebrow}</p>

      <h2 className="text-2xl text-balance uppercase md:text-3xl">{title}</h2>

      {sub && (
        <p
          className={cn(
            'text-muted-foreground max-w-xl text-sm leading-relaxed text-balance',
            centered && 'text-center'
          )}
        >
          {sub}
        </p>
      )}
    </Reveal>
  );
}
