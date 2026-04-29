'use client';

import { useEffect, useState } from 'react';

import { ZapIcon } from 'lucide-react';
import { motion as m } from 'motion/react';

import Container from '@/components/common/container';
import Timeline from '@/components/statements/timeline';
import { Button } from '@/components/ui/button';
import { STATEMENTS } from '@/data/statements';
import { getTimeRemaining } from '@/lib/helpers';

interface statementPageProps {
  params: Promise<{ id: string }>;
}

export default function StatementPage({ params }: statementPageProps) {
  const statement = STATEMENTS.find((s) => params.then((p) => s.id === p.id));
  const [remainingTime, setRemainingTime] = useState(() =>
    getTimeRemaining(statement?.livenessDeadline)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime(getTimeRemaining(statement?.livenessDeadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [statement?.livenessDeadline]);

  return (
    <Container className="border-muted-foreground/50 border-x border-dashed py-16">
      <header className="border-foreground/50 flex items-center justify-between border-b border-dashed px-4 h-16">
        <h2 className="md:text-sm text-xs font-semibold tracking-tight uppercase">
          BOND: <span className="text-orange-300">{statement?.bondAmountPUSD} OPAL</span>
        </h2>
        <h2 className="md:text-sm text-xs font-semibold tracking-tight uppercase">
          Time Remaining: {remainingTime}
        </h2>
      </header>
      <div className="flex flex-col justify-between px-4 md:flex-row">
        <div className="flex flex-col gap-8 py-8">
          <m.h1
            layout
            layoutId={`statement-${statement?.id}`}
            className="w-fit text-3xl font-semibold tracking-tighter md:text-4xl"
          >
            {statement?.statement}
          </m.h1>
          <h2></h2>
          <Button variant="destructive" size="lg" className="md:w-fit">
            <ZapIcon />
            <span>Dispute this Statement</span>
          </Button>
        </div>
        <Timeline statement={statement} />
      </div>
    </Container>
  );
}
