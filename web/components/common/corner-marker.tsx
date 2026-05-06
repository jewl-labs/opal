import { cn } from '@/lib/utils';

interface CornerMarkerProps {
  position?: 'top' | 'bottom';
}

export default function CornerMarker({ position = 'top' }: CornerMarkerProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <span
        className={cn(
          'bg-accent-foreground absolute size-2',
          position === 'top' ? '-top-1 -left-1' : '-bottom-1 -left-1'
        )}
      />
      <span
        className={cn(
          'bg-accent-foreground absolute size-2',
          position === 'top' ? '-top-1 -right-1' : '-right-1 -bottom-1'
        )}
      />
    </div>
  );
}
