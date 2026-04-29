import { AnimatePresence, motion as m } from 'motion/react';

interface Props {
  open: boolean;
  statement: string;
  bond: number;
  windowLabel: string;
  windowValue: number;
  evidenceUrl: string;
  hashPreview: (s: string) => string;
  formatExpiry: (n: number) => string;
}

export default function SummarySection({
  open,
  statement,
  bond,
  windowLabel,
  windowValue,
  evidenceUrl,
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
            className="flex h-full flex-col justify-center p-6"
          >
            <div className="grid grid-cols-[120px_1fr] gap-x-6 gap-y-3 text-sm">
              <span className="text-muted-foreground/40">Statement</span>
              <span className="text-muted-foreground/80 leading-snug">
                {statement || <span className="text-muted-foreground/25">—</span>}
              </span>

              <span className="text-muted-foreground/40">Bond</span>
              <span className="text-primary">{bond} PUSD</span>

              <span className="text-muted-foreground/40">Window</span>
              <span className="text-muted-foreground/80">{windowLabel}</span>

              <span className="text-muted-foreground/40">Expires</span>
              <span className="text-muted-foreground/60 text-xs">
                {formatExpiry(windowValue)}
              </span>

              {evidenceUrl && (
                <>
                  <span className="text-muted-foreground/40">Aux hash</span>
                  <span className="text-muted-foreground/50 text-xs">{hashPreview(evidenceUrl)}</span>
                </>
              )}
            </div>

            <div className="border-muted-foreground/10 mt-6 grid grid-cols-2 gap-4 border-t border-dashed pt-5 text-sm">
              <div className="text-muted-foreground/35">
                <span className="text-muted-foreground/50 mb-1 block text-xs tracking-wider uppercase">
                  If undisputed
                </span>
                Resolves TRUE · bond returned
              </div>
              <div className="text-muted-foreground/35">
                <span className="text-muted-foreground/50 mb-1 block text-xs tracking-wider uppercase">
                  If disputed
                </span>
                LLM resolution triggered
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
