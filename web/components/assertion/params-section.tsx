import { Clock } from '@phosphor-icons/react';
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
      transition={{ duration: 0.35, ease: [0.32, 0, 0.67, 0] }}
      style={{ minHeight: 0 }}
    >
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative h-full"
          >
            <div className="absolute top-0 left-6 right-6 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent" />

            <div className="grid h-full grid-cols-1 gap-0 px-6 py-8 md:grid-cols-2">
              <div className="flex flex-col justify-center gap-6 pr-0 md:pr-10">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/40 uppercase">
                    01 /
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/55 uppercase">
                    Dispute Window
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {windows.map((w, i) => {
                    const active = window_ && window_.value === w.value;
                    return (
                      <m.button
                        key={w.value}
                        onClick={() => setWindow(w)}
                        whileTap={{ scale: 0.97 }}
                        className={`relative px-4 py-2.5 font-mono text-sm transition-all duration-200 ${
                          active
                            ? 'text-primary'
                            : 'text-muted-foreground/50 hover:text-muted-foreground/80'
                        }`}
                      >
                        <span
                          className={`absolute inset-0 transition-all duration-200 ${
                            active
                              ? 'border border-primary/60 shadow-[inset_0_0_12px_rgba(var(--primary-rgb),0.06),0_0_0_1px_rgba(var(--primary-rgb),0.08)]'
                              : 'border border-muted-foreground/15 hover:border-muted-foreground/30'
                          }`}
                        />
                        {active && (
                          <>
                            <span className="absolute top-0 left-0 h-1.5 w-1.5 border-t border-l border-primary/80" />
                            <span className="absolute top-0 right-0 h-1.5 w-1.5 border-t border-r border-primary/80" />
                            <span className="absolute bottom-0 left-0 h-1.5 w-1.5 border-b border-l border-primary/80" />
                            <span className="absolute bottom-0 right-0 h-1.5 w-1.5 border-b border-r border-primary/80" />
                          </>
                        )}
                        <span className="relative">{w.label}</span>
                      </m.button>
                    );
                  })}
                </div>

                <p className="font-mono text-[11px] leading-relaxed text-muted-foreground/35 max-w-70">
                  Shorter windows resolve faster. Longer windows allow more time to dispute.
                </p>
              </div>

              <div className="hidden md:block absolute left-1/2 top-8 bottom-8 w-px bg-linear-to-b from-transparent via-muted-foreground/15 to-transparent" />

              <div className="flex flex-col justify-center gap-7 border-t border-dashed border-muted-foreground/15 pt-7 md:border-t-0 md:pt-0 md:pl-10">

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/40 uppercase">
                      02 /
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/55 uppercase">
                      Assertion Bond
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground/30 border border-muted-foreground/20 px-1.5 py-0.5 tracking-wider">
                      FIXED
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-4xl font-light tracking-tight text-primary leading-none">
                      {bond}
                    </span>
                    <span className="font-mono text-base text-primary/60 tracking-widest">PUSD</span>
                  </div>

                  <p className="font-mono text-[11px] text-muted-foreground/35">
                    ↩ Returned if undisputed within window.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="h-px bg-muted-foreground/10" />

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/40 uppercase">
                      03 /
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/55 uppercase">
                      Resolution Timing
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 pl-0.5">
                    <Clock
                      size={13}
                      className="mt-0.75 shrink-0 text-muted-foreground/35"
                    />
                    <div className="font-mono text-sm leading-6 text-muted-foreground/50 space-y-0.5">
                      <div>
                        Window{' '}
                        <span className="text-foreground/75 font-medium">
                          {window_?.label}
                        </span>
                      </div>
                      <div>
                        Expires{' '}
                        <span className="text-foreground/75 font-medium">
                          {formatExpiry(window_?.value ?? windows[0]?.value)}
                        </span>
                      </div>
                    </div>
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