import { ClockIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion as m } from 'motion/react';

interface Props {
  open: boolean;
  bond: number;
  windowLabel: string;
  windowSeconds: number;
  formatExpiry: (s: number) => string;
}

function formatRelativeExpiry(expiryText: string) {
  const target = new Date(expiryText).getTime();
  if (Number.isNaN(target)) return expiryText;

  const diff = Math.max(0, target - Date.now());
  const totalHours = Math.floor(diff / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return hours > 0 ? `in ${days}d ${hours}h` : `in ${days}d`;
  }

  return hours > 0 ? `in ${hours}h` : 'soon';
}

export default function ParamsSection({
  open,
  bond,
  windowLabel,
  windowSeconds,
  formatExpiry,
}: Props) {
  const expiry = formatExpiry(windowSeconds);

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
            <div className="grid flex-1 grid-cols-1 gap-8 md:grid-cols-2">
              <div className="flex flex-col justify-center gap-4">
                <div className="flex items-center gap-2">
                  <ClockIcon size={16} className="text-muted-foreground/50" />
                  <span className="text-muted-foreground/50 font-mono text-xs tracking-widest uppercase">
                    Dispute Window
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-primary font-mono text-4xl tabular-nums">
                    {windowLabel}
                  </span>
                </div>

                <p className="text-muted-foreground/85 text-xs">
                  Every assertion gets a fixed {windowLabel} liveness window. If no one disputes
                  before it closes, the assertion finalizes TRUE.
                </p>
              </div>

              <div className="border-muted-foreground/20 flex flex-col justify-center gap-6 border-t pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-8">
                <div className="flex flex-col gap-2">
                  <span className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
                    Assertion Bond
                  </span>

                  <div className="flex items-baseline gap-2">
                    <span className="text-primary font-mono text-4xl tabular-nums">{bond}</span>
                    <span className="text-primary/60 font-mono text-base uppercase">USDC</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
                    Expires
                  </span>
                  <span className="font-mono text-base uppercase tabular-nums">{expiry}</span>
                  <span className="text-muted-foreground/85 text-xs">
                    {formatRelativeExpiry(expiry)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-muted-foreground/85 text-xs">
                Bond is returned if the assertion survives the dispute window.
              </span>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
