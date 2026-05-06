import { cn } from '@/lib/utils';

interface CornerMarkerProps {
  position?: 'top' | 'bottom';
}

export default function CornerMarker({ position = 'top' }: CornerMarkerProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <span
        className={cn(
          'bg-muted-foreground absolute size-1.5',
          position === 'top' ? '-top-0.75 -left-0.75' : '-bottom-0.75 -left-0.75'
        )}
      />
      <span
        className={cn(
          'bg-muted-foreground absolute size-1.5',
          position === 'top' ? '-top-0.75 -right-0.75' : '-right-0.75 -bottom-0.75'
        )}
      />
    </div>
  );
}
