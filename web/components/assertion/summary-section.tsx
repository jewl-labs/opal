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
              <p className="text-foreground text-lg leading-relaxed md:text-xl">
                {statement || <span className="text-muted-foreground/45">—</span>}
              </p>
            </div>

            <div className="mx-auto mt-6 grid w-full max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
              <div className="min-w-0">
                <div className="text-muted-foreground/75 text-[10px] tracking-[0.18em] uppercase">
                  Bond
                </div>
                <div className="text-primary mt-1 text-sm">{bond} PUSD</div>
              </div>

              <div className="min-w-0">
                <div className="text-muted-foreground/75 text-[10px] tracking-[0.18em] uppercase">
                  Window
                </div>
                <div className="text-foreground mt-1 truncate text-sm">{windowLabel}</div>
              </div>

              <div className="min-w-0">
                <div className="text-muted-foreground/75 text-[10px] tracking-[0.18em] uppercase">
                  Expires
                </div>
                <div className="text-foreground mt-1 text-sm">
                  {compactExpiry(formatExpiry(windowValue))}
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-muted-foreground/75 text-[10px] tracking-[0.18em] uppercase">
                  Aux Hash
                </div>
                <div className="text-foreground mt-1 truncate text-sm">
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
