'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { motion as m } from 'motion/react';

import Container from '@/components/common/container';
import Timeline from '@/components/assertion/timeline';
import { Button } from '@/components/ui/button';
import { ASSERTIONS } from '@/data/assertion';
import { getTimeRemaining } from '@/lib/helpers';
import { LinkBreakIcon } from '@phosphor-icons/react';

export default function StatementPage() {
  const params = useParams();
  const id = params?.id as string;

  const statement = ASSERTIONS.find((s) => s.id === id);

  const [remainingTime, setRemainingTime] = useState(() =>
    getTimeRemaining(statement?.livenessDeadline)
  );

  useEffect(() => {
    if (!statement?.livenessDeadline) return;

    const interval = setInterval(() => {
      setRemainingTime(getTimeRemaining(statement.livenessDeadline));
    }, 1000);

    return () => clearInterval(interval);
  }, [statement?.livenessDeadline]);

  if (!statement) {
    return <div>not found</div>;
  }

  return (
    <Container className="border-muted-foreground/50 border-x border-dashed py-16">
      <header className="border-foreground/50 flex items-center justify-between border-b border-dashed px-4 h-16">
        <h2 className="md:text-sm text-xs font-semibold tracking-tight uppercase">
          BOND: <span className="text-orange-300">{statement.bondAmountPUSD} PUSD</span>
        </h2>
        <h2 className="md:text-sm text-xs font-semibold tracking-tight uppercase">
          Time Remaining: {remainingTime}
        </h2>
      </header>

      <div className="flex flex-col justify-between px-4 md:flex-row">
        <div className="flex flex-col gap-8 py-8">
          <m.h1
            layout
            layoutId={`statement-${statement.id}`}
            className="w-fit text-3xl tracking-tight font-medium md:text-4xl"
          >
            {statement.statement}
          </m.h1>

          <Button variant="destructive" size="lg" className="md:w-fit">
            <LinkBreakIcon />
            <span>Dispute this Statement</span>
          </Button>
        </div>

        <Timeline statement={statement} />
      </div>
    </Container>
  );
}