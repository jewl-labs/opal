import { cn } from '@/lib/utils';

// Blueprint-style crosshair at each section corner: a fine "+" with a brighter core.
const CORNERS = ['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'];

export default function CornerMarkers() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {CORNERS.map((pos) => (
        <span key={pos} className={cn('absolute z-20 size-4', pos)}>
          <span className="bg-primary/60 absolute top-1/2 left-0 h-px w-full -translate-y-1/2" />
          <span className="bg-primary/60 absolute top-0 left-1/2 h-full w-px -translate-x-1/2" />
          <span className="bg-primary absolute top-1/2 left-1/2 size-[3px] -translate-x-1/2 -translate-y-1/2" />
        </span>
      ))}
    </div>
  );
}
