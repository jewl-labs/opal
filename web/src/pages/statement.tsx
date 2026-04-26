import Container from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { STATEMENT_DATA } from '@/lib/constants';
import { ChevronRight, ZapIcon } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { motion as m } from 'motion/react';

export default function Statement() {
  const { id } = useParams();
  const statement = STATEMENT_DATA.find((c) => c.id === id);

  return (
    <Container className="border-muted-foreground/50 border-x border-dashed py-16">
      <header className="border-foreground/50 flex items-center justify-between border-b border-dashed p-4">
        <h2 className="text-sm font-semibold tracking-tight uppercase"></h2>
        <h2 className="text-sm font-semibold tracking-tight uppercase">
          Status: <span className="text-orange-300">{statement?.status}</span>
        </h2>
      </header>
      <div className="flex flex-col justify-between px-4 md:flex-row">
        <div className="flex flex-col gap-8 py-8">
          <m.h1
            layout
            layoutId={`statement-${statement?.id}`}
            className="w-fit text-3xl font-semibold tracking-tight md:text-4xl"
          >
            {statement?.statement}
          </m.h1>
          <Button variant="destructive" size="lg" className="md:w-fit">
            <ZapIcon />
            <span>DIspute this Claim</span>
          </Button>
        </div>
        <Timeline />
      </div>
    </Container>
  );
}

function Timeline() {
  return (
    <div className="relative flex h-[80vh] w-fit flex-col py-8">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs whitespace-nowrap uppercase">
          25 Jan 2026
        </span>
        <span className="text-xs whitespace-nowrap uppercase">Proposed</span>
        <ChevronRight className="size-3" />
        <span className="ring-secondary z-10 size-2 shrink-0 rounded-full bg-orange-400 ring-2" />
      </div>

      <svg
        width="1"
        className="mr-[3px] ml-auto flex-1"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <line
          x1="0.5"
          x2="0.5"
          y1="0"
          y2="100%"
          strokeDasharray="8 8"
          className="stroke-muted-foreground/50"
        />
      </svg>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs whitespace-nowrap uppercase">
          02 Feb 2026
        </span>
        <span className="text-xs whitespace-nowrap uppercase">Resolved</span>
        <ChevronRight className="size-3" />
        <span className="ring-secondary z-10 size-2 shrink-0 rounded-full bg-green-400 ring-2" />
      </div>
    </div>
  );
}
