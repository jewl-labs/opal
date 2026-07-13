import { AnimatePresence, motion as m } from 'motion/react';

interface Props {
  open: boolean;
  statement: string;
  bond: number;
  windowLabel: string;
  windowValue: number;
  auxiliaryData: string;
  hashPreview: (s: string) => string;
  formatExpiry: (n: number) => string;
}

function compactExpiry(expiry: string) {
  const date = new Date(expiry);
  if (Number.isNaN(date.getTime())) return expiry;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function SummarySection({
  open,
  statement,
  bond,
  windowLabel,
  windowValue,
  auxiliaryData,
  hashPreview,
  formatExpiry,
}: Props) {
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
            className="flex h-full flex-col justify-center p-6 md:p-7"
          >
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-foreground text-xl leading-relaxed md:text-2xl">
                {statement || (
                  <span className="text-muted-foreground/60 text-base md:text-lg">
                    No statement yet — start with the Statement section
                  </span>
                )}
              </p>
            </div>

            <div className="mx-auto mt-10 grid w-full max-w-3xl grid-cols-2 gap-6 md:grid-cols-4">
              <div className="border-border min-w-0 border-l pl-4">
                <div className="text-muted-foreground/75 font-mono text-[11px] tracking-[0.2em] uppercase">
                  Bond
                </div>
                <div className="text-primary mt-1 font-mono text-base tabular-nums">
                  {bond} USDC
                </div>
              </div>

              <div className="border-border min-w-0 border-l pl-4">
                <div className="text-muted-foreground/75 font-mono text-[11px] tracking-[0.2em] uppercase">
                  Window
                </div>
                <div className="text-foreground mt-1 truncate font-mono text-base">
                  {windowLabel}
                </div>
              </div>

              <div className="border-border min-w-0 border-l pl-4">
                <div className="text-muted-foreground/75 font-mono text-[11px] tracking-[0.2em] uppercase">
                  Expires
                </div>
                <div className="text-foreground mt-1 font-mono text-base tabular-nums">
                  {compactExpiry(formatExpiry(windowValue))}
                </div>
              </div>

              <div className="border-border min-w-0 border-l pl-4">
                <div className="text-muted-foreground/75 font-mono text-[11px] tracking-[0.2em] uppercase">
                  Spec Hash
                </div>
                <div className="text-foreground mt-1 truncate font-mono text-base">
                  {auxiliaryData ? hashPreview(auxiliaryData) : '—'}
                </div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
