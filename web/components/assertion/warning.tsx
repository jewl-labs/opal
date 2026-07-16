import { WarningOctagonIcon } from '@phosphor-icons/react';
import { m } from 'motion/react';

export default function Warning({ msg }: { msg: string }) {
  return (
    <m.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-2 text-xs text-amber-400/85 md:text-sm"
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <WarningOctagonIcon size={14} />
      {msg}
    </m.div>
  );
}
