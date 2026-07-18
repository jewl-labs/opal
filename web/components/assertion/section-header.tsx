import type { ReactNode } from 'react';

import { CaretDownIcon } from '@phosphor-icons/react';
import { m } from 'motion/react';

import { cn } from '@/lib/utils';

export default function SectionHeader({
  label,
  open,
  onClick,
  peek,
  showShortcut,
  shortcutHint,
  complete,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
  peek?: ReactNode;
  showShortcut?: boolean;
  shortcutHint?: string;
  /** Marks the section's input as filled/valid — lights the status marker lime. */
  complete?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        'border-border hover:bg-muted/50 flex w-full items-center justify-between border-t px-6 py-5 text-left transition-colors',
        open && 'bg-muted/30'
      )}
    >
      <div className="flex flex-1 items-center gap-3.5">
        <span
          className={cn(
            'size-1.5 shrink-0 transition-colors',
            complete ? 'bg-primary' : open ? 'bg-foreground/60' : 'bg-muted-foreground/30'
          )}
        />
        <span
          className={cn(
            'font-mono text-sm tracking-widest uppercase transition-colors md:text-base',
            open ? 'text-foreground' : complete ? 'text-foreground/80' : 'text-muted-foreground'
          )}
        >
          {label}
        </span>
        {peek && !open && (
          <m.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground/60 max-w-60 truncate text-xs md:text-sm"
          >
            {peek}
          </m.span>
        )}
        {showShortcut && shortcutHint && (
          <m.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground/50 ml-auto font-mono text-xs"
          >
            {shortcutHint}
          </m.span>
        )}
      </div>
      <m.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
        <CaretDownIcon
          className={cn('size-5 stroke-1', open ? 'text-primary' : 'text-muted-foreground/60')}
        />
      </m.div>
    </button>
  );
}
