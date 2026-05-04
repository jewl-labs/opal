import { AnimatePresence, motion as m } from 'motion/react';
import { Clock } from '@phosphor-icons/react';

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
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid h-full grid-cols-1 gap-0 p-6 md:grid-cols-2 md:gap-10"
          >
            <div className="flex flex-col justify-center gap-5">
              <label className="text-muted-foreground/55 text-base tracking-widest uppercase md:text-lg">
                Dispute Window
              </label>
              <div className="flex flex-wrap gap-3">
                {windows.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setWindow(w)}
                    className={`border px-5 py-3 text-lg transition-colors ${
                      window_ && window_.value === w.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted-foreground/25 text-muted-foreground/70 hover:border-muted-foreground/50'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-muted-foreground/20 flex flex-col justify-center gap-5 border-t border-dashed pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-8">
              <div>
                <span className="text-muted-foreground/55 text-base tracking-widest uppercase md:text-lg">
                  Assertion Bond (fixed)
                </span>
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-primary text-5xl leading-none font-light">{bond}</span>
                  <span className="text-primary/85 mb-1 text-2xl">PUSD</span>
                </div>
                <p className="text-muted-foreground/45 mt-2 text-lg">Returned if undisputed.</p>
              </div>

              <div className="border-muted-foreground/15 border-t border-dashed pt-4">
                <label className="text-muted-foreground/50 text-base tracking-widest uppercase md:text-lg">
                  Resolution timing
                </label>
                <div className="mt-3 flex items-start gap-2">
                  <Clock size={16} className="text-muted-foreground/45 mt-1" />
                  <span className="text-muted-foreground/70 text-lg leading-relaxed">
                    Selected window: <span className="text-foreground/85">{window_?.label}</span>
                    <br />
                    Expires <span className="text-foreground/85">{formatExpiry(window_?.value ?? windows[0]?.value)}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/40 text-base md:text-lg">
                  Shorter windows resolve faster. Longer windows allow more time to dispute.
                </span>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
