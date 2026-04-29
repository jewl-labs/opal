import { m } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

export default function Warning({ msg }: { msg: string }) {
  return (
    <m.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-1.5 text-xs text-amber-400/80"
    >
      <AlertTriangle size={12} />
      {msg}
    </m.div>
  );
}
