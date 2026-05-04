import { AnimatePresence, motion as m } from 'motion/react';

import { Textarea } from '@/components/ui/textarea';

import Warning from './warning';
import { FileTextIcon } from '@phosphor-icons/react';

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
            className="flex h-full flex-col justify-center gap-4 p-6"
          >
            <div className="flex items-center gap-2">
              <FileTextIcon size={18} className="text-muted-foreground/50" />
              <span className="text-muted-foreground/50 text-base md:text-lg">Auxiliary data</span>
            </div>
            <Textarea
              placeholder="Describe how this statement should be resolved. Include evidence sources, ambiguity handling, edge cases, and explicit criteria for TRUE vs FALSE outcomes."
              value={auxiliaryData}
              onChange={(e) => setAuxiliaryData(e.target.value)}
              className="border-muted-foreground/30 resize-none focus-visible:border-primary/50 min-h-40 border border-dashed bg-transparent text-lg leading-relaxed md:text-xl focus-visible:ring-0"
            />
            <span className="text-muted-foreground/35 text-base leading-relaxed md:text-lg">
              Provide a resolution spec for adjudicators. Explain ambiguity rules, acceptable
              sources, fallback assumptions, and any tie-break conditions. Only the content hash is
              stored onchain.
            </span>
            {!auxiliaryData && statementLength > 20 && (
              <Warning msg="No auxiliary data — higher chance of Unresolvable outcome" />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
