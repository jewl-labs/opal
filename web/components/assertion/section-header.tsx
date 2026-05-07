import type { ReactNode } from 'react';

import { CaretDownIcon } from '@phosphor-icons/react';
import { m } from 'motion/react';

export default function SectionHeader({
  label,
  open,
  onClick,
  peek,
  showShortcut,
  shortcutHint,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
  peek?: ReactNode;
  showShortcut?: boolean;
  shortcutHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="border-muted-foreground/50 hover:bg-muted/50 flex w-full items-center justify-between border-t border-dashed px-6 py-4 text-left transition-colors"
    >
      <div className="flex flex-1 items-center gap-3">
        <span
          className={`text-sm font-medium tracking-widest uppercase transition-colors md:text-base ${
            open ? 'text-foreground' : 'text-foreground/50'
          }`}
        >
          {label}
        </span>
        {peek && !open && (
          <m.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground/45 max-w-60 truncate text-xs md:text-sm"
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
        <CaretDownIcon className="text-muted-foreground/40 size-5 stroke-1" />
      </m.div>
    </button>
  );
}
