import { Link2 } from 'lucide-react';
import { AnimatePresence, motion as m } from 'motion/react';

import { Input } from '@/components/ui/input';

import Warning from './Warning';

interface Props {
  open: boolean;
  evidenceUrl: string;
  setEvidenceUrl: (v: string) => void;
  statementLength: number;
}

export default function EvidenceSection({
  open,
  evidenceUrl,
  setEvidenceUrl,
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
              <Link2 size={16} className="text-muted-foreground/50" />
              <span className="text-muted-foreground/50 text-sm">Source URL</span>
            </div>
            <Input
              placeholder="https://..."
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="border-muted-foreground/30 focus-visible:border-primary/50 border-dashed bg-transparent text-base focus-visible:ring-0"
            />
            <span className="text-muted-foreground/35 text-sm">
              Source, article, or document that helps resolve this claim. Only the content hash is
              stored onchain.
            </span>
            {!evidenceUrl && statementLength > 20 && (
              <Warning msg="No evidence link — higher chance of Unresolvable outcome" />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
