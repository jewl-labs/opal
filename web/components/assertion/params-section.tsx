import { Clock, ClockIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion as m } from 'motion/react';

interface WindowOption {
  label: string;
  value: number;
}

interface Props {
  open: boolean;
  bond: number;
  window_: WindowOption;
  setWindow: (w: WindowOption) => void;
  windows: WindowOption[];
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

function getWindowMeta(label: string) {
  // single-accent minimal styling for all durations
  return {
    tone: 'border-muted-foreground/20 bg-transparent text-muted-foreground',
    accent: 'bg-primary/60',
    note: '',
  };
}

export default function ParamsSection({
  open,
  bond,
  window_,
  setWindow,
  windows,
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
            className="relative flex h-full flex-col justify-center overflow-hidden p-4 md:p-5"
            transition={{ duration: 0.2 }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.055)_1px,transparent_0)] bg-size-[16px_16px] opacity-35" />
            <div className="to-background/15 pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-transparent" />

            <div className="relative flex flex-col gap-8">
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <ClockIcon size={14} className="text-muted-foreground/75" />
                    <div className="text-muted-foreground/85 text-xs tracking-[0.2em] uppercase">
                      Dispute Window
                    </div>
                  </div>

                  <div className="text-muted-foreground/75 text-xs uppercase">
                    Stake duration determines challenge period
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {windows.map((w) => {
                    const active = window_.value === w.value;
                    return (
                      <m.button
                        key={w.value}
                        onClick={() => setWindow(w)}
                        className={`relative flex h-12 items-center justify-center rounded-md border px-3 text-[11px] tracking-wide uppercase transition-colors duration-150 ${
                          active
                            ? 'border-primary/80 bg-primary/10 text-primary'
                            : 'border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/10'
                        }`}
                      >
                        <div className="text-muted-foreground/85 z-10">{w.label}</div>
                      </m.button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex flex-col items-center gap-3">
                  <div className="text-muted-foreground/85 text-xs tracking-widest uppercase">
                    Bond
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-primary text-2xl leading-none font-extralight tracking-tight">
                      {bond} PUSD
                    </div>
                  </div>

                  <div className="text-muted-foreground/85 text-xs tracking-wide uppercase">
                    {formatRelativeExpiry(formatExpiry(window_?.value ?? windows[0]?.value))}
                  </div>
                </div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
