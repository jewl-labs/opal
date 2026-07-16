'use client';

import { useEffect, useRef } from 'react';

import { XIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion as m } from 'motion/react';

import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Mono uppercase title shown in the header bar next to the accent square. */
  title: string;
  children: React.ReactNode;
  /** 'center' (default) or 'top' for command-palette style dialogs. */
  align?: 'center' | 'top';
  className?: string;
}

// The single popup chrome for the app: dimmed blurred backdrop, bordered panel,
// accent-square header with Esc/close affordance, subtle scale/fade enter.
export default function Modal({
  open,
  onClose,
  title,
  children,
  align = 'center',
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Keep the latest onClose in a ref so the effect below can depend on `open` alone —
  // otherwise an inline onClose prop re-runs the effect on every parent render, which
  // restores scroll and steals focus out of the open dialog.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog unless something inside already holds it (e.g. an
    // autoFocus input), so keyboard/screen-reader users start inside the modal rather
    // than on the now-obscured trigger.
    if (panel && !panel.contains(document.activeElement)) panel.focus();

    // Lock background scroll while the dialog is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      const inside = panel.contains(active);
      // Wrap at both ends, and pull focus back in when it's on the panel itself or has
      // escaped the panel — otherwise Tab/Shift+Tab reaches the page behind the backdrop.
      if (e.shiftKey) {
        if (!inside || active === first || active === panel) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!inside || active === last || active === panel) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocusedRef.current?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className={cn(
            'fixed inset-0 z-50 flex justify-center bg-black/70 px-4 backdrop-blur-sm',
            align === 'top' ? 'items-start pt-[18vh]' : 'items-center'
          )}
        >
          <m.div
            ref={panelRef}
            initial={{ scale: 0.97, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={cn(
              'bg-background border-border relative w-full max-w-2xl border shadow-2xl shadow-black/70 outline-none',
              className
            )}
          >
            <div className="border-border flex items-center justify-between border-b px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="bg-primary size-1.5" />
                <h2 className="text-muted-foreground font-mono text-[11px] font-medium tracking-[0.2em] uppercase">
                  {title}
                </h2>
              </div>

              <button
                aria-label="Close"
                onClick={onClose}
                className="text-muted-foreground/50 hover:text-foreground flex items-center gap-2 transition-colors"
              >
                <Kbd>Esc</Kbd>
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">{children}</div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
