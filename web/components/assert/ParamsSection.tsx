import { Clock } from 'lucide-react';
import { AnimatePresence, motion as m } from 'motion/react';

import { Input } from '@/components/ui/input';

import Warning from './Warning';

interface WindowOption {
  label: string;
  value: number;
}

interface Props {
  open: boolean;
  bond: number;
  setBond: (v: number) => void;
  bondWarning: string | null;
  minBond: number;
  window_: WindowOption;
  setWindow: (w: WindowOption) => void;
  windows: WindowOption[];
  formatExpiry: (s: number) => string;
}

export default function ParamsSection({
  open,
  bond,
  setBond,
  bondWarning,
  minBond,
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
            className="grid h-full grid-cols-1 gap-0 p-6 md:grid-cols-2 md:gap-8"
          >
            {/* bond */}
            <div className="flex flex-col justify-center gap-3">
              <label className="text-muted-foreground/50 text-xs tracking-widest uppercase">
                Assertion Bond
              </label>
              <div className="flex items-baseline gap-3">
                <Input
                  type="number"
                  min={minBond}
                  value={bond}
                  onChange={(e) => setBond(Number(e.target.value))}
                  className="h-auto w-28 appearance-none border-none bg-transparent p-3 text-4xl font-light focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-primary text-lg">PUSD</span>
              </div>
              <AnimatePresence mode="wait">
                {bondWarning ? (
                  <Warning key="bw" msg={bondWarning} />
                ) : (
                  <m.span
                    key="bh"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-muted-foreground/35 text-sm"
                  >
                    Min {minBond} PUSD · returned if undisputed
                  </m.span>
                )}
              </AnimatePresence>
            </div>

            {/* window */}
            <div className="flex flex-col justify-center gap-3">
              <label className="text-muted-foreground/50 text-xs tracking-widest uppercase">
                Dispute Window
              </label>
              <div className="flex flex-wrap gap-2">
                {windows.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setWindow(w)}
                    className={`border border-dotted px-4 py-2 text-sm transition-colors ${
                      window_ && window_.value === w.value
                        ? 'border-primary text-primary'
                        : 'border-muted-foreground/25 text-muted-foreground/50 hover:border-muted-foreground/50'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-muted-foreground/35" />
                <span className="text-muted-foreground/35 text-sm">
                  Expires {formatExpiry(window_?.value ?? windows[0]?.value)}
                </span>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
