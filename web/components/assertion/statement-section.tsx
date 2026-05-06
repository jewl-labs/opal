import { AnimatePresence, motion as m } from 'motion/react';

import { Textarea } from '@/components/ui/textarea';

import Warning from './warning';

interface Props {
  open: boolean;
  value: string;
  setValue: (v: string) => void;
  warning: string | null;
  maxChars: number;
}

export default function StatementSection({ open, value, setValue, warning, maxChars }: Props) {
  return (
    <m.div
      className="flex flex-col overflow-hidden"
      animate={{ flex: open ? 1 : 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{ minHeight: 0 }}
    >
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-full flex-col p-6"
          >
            <Textarea
              id="statement"
              placeholder="Kanye West's Delhi concert got postponed"
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, maxChars))}
              className="min-h-0 flex-1 resize-none text-base leading-relaxed md:text-lg"
            />
            <div className="mt-3 flex items-center justify-between">
              <AnimatePresence mode="wait">
                {warning ? (
                  <Warning key="sw" msg={warning} />
                ) : (
                  <m.span
                    key="sh"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-muted-foreground/55 text-sm md:text-base"
                  >
                    Write a specific, falsifiable claim
                  </m.span>
                )}
              </AnimatePresence>
              <span
                className={`text-sm tabular-nums md:text-base ${
                  value.length > maxChars * 0.9 ? 'text-amber-400' : 'text-muted-foreground/50'
                }`}
              >
                {value.length} / {maxChars}
              </span>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
