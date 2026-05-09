'use client';

import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LinkBreakIcon } from '@phosphor-icons/react';
import { motion as m } from 'motion/react';

import Timeline from '@/components/assertion/timeline';
import Container from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { ASSERTIONS } from '@/data/assertion';
import { getTimeRemaining } from '@/lib/helpers';

export default function StatementPage() {
  const { id } = useParams();

  const statement = ASSERTIONS.find((s) => s.id === id);

  if (!statement) {
    notFound();
  }

  const [remainingTime, setRemainingTime] = useState(() =>
    statement.livenessDeadline ? getTimeRemaining(statement.livenessDeadline) : '—'
  );

  useEffect(() => {
    if (!statement?.livenessDeadline) return;

    const interval = setInterval(() => {
      setRemainingTime(getTimeRemaining(statement.livenessDeadline));
    }, 1000);

    return () => clearInterval(interval);
  }, [statement?.livenessDeadline]);

  return (
    <Container className="border-muted-foreground/50 border-x border-dashed py-16">
      <header className="border-foreground/50 flex h-16 items-center justify-between border-b border-dashed px-4">
        <h2 className="text-xs font-semibold tracking-tight uppercase md:text-sm">
          BOND: <span className="text-orange-300">{statement.bondAmountPUSD} PUSD</span>
        </h2>
        <h2 className="text-xs font-semibold tracking-tight uppercase md:text-sm">
          Time Remaining: {remainingTime}
        </h2>
      </header>

      <div className="flex flex-col justify-between px-4 md:flex-row">
        <div className="flex flex-col gap-8 py-8">
          <m.h1
            layout
            layoutId={`statement-${statement.id}`}
            className="w-fit text-3xl font-medium tracking-tight md:text-4xl"
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
