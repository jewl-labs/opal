import { AnimatePresence, motion as m } from 'motion/react';

import { Textarea } from '@/components/ui/textarea';

import Warning from './warning';

interface Props {
  open: boolean;
  auxiliaryData: string;
  setAuxiliaryData: (v: string) => void;
  statementLength: number;
}

export default function EvidenceSection({
  open,
  auxiliaryData,
  setAuxiliaryData,
  statementLength,
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
            className="flex h-full flex-col p-6"
          >
            <Textarea
              placeholder="Add supporting notes or links."
              value={auxiliaryData}
              onChange={(e) => setAuxiliaryData(e.target.value)}
              className="min-h-0 flex-1 resize-none text-sm leading-relaxed md:text-sm"
            />

            <div className="mt-3 flex items-center justify-between">
              <AnimatePresence mode="wait">
                {!auxiliaryData && statementLength > 20 ? (
                  <Warning
                    key="ew"
                    msg="No auxiliary data - higher chance of Unresolvable outcome"
                  />
                ) : (
                  <m.span
                    key="eh"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-muted-foreground/85 text-xs md:text-xs"
                  >
                    Optional context. Only the hash is stored onchain.
                  </m.span>
                )}
              </AnimatePresence>

              <span className="text-muted-foreground/85 text-xs tabular-nums md:text-xs">
                {auxiliaryData.length}
              </span>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
