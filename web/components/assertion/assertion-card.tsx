'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CheckCircleIcon, ClockIcon, WarningOctagonIcon } from '@phosphor-icons/react';
import { motion as m } from 'motion/react';

import { useHydrated } from '@/hooks/use-hydrated';
import {
  getContextualMessage,
  getDisputeLevel,
  getFinalizationStatus,
  getOutcomeLabel,
  getStageLabel,
} from '@/lib/assertion-labels';
import { getTimeRemaining } from '@/lib/helpers';
import type { AssertionAccount } from '@/types';

export default function AssertionCard({ data }: { data: AssertionAccount }) {
  // The countdown is only shown after hydration — the SSR-computed value is ~1s
  // stale by the time the client hydrates, which triggers a hydration mismatch.
  const hydrated = useHydrated();
  const [remainingTime, setRemainingTime] = useState(() =>
    data.livenessDeadline ? getTimeRemaining(data.livenessDeadline) : '—'
  );

  useEffect(() => {
    if (!data.livenessDeadline) return;

    const interval = setInterval(() => {
      setRemainingTime(getTimeRemaining(data.livenessDeadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [data.livenessDeadline]);

  const finalizationStatus = getFinalizationStatus(data);
  const disputeLevel = getDisputeLevel(data);
  const contextualMsg = getContextualMessage(data);
  const stage = getStageLabel(data.state);

  const finalizationColor = {
    finalized: 'bg-green-950/40 text-green-300 border-green-900/50',
    pending: 'bg-red-950/40 text-red-300 border-red-900/50',
    optimistic: 'bg-orange-950/40 text-orange-300 border-orange-900/50',
  }[finalizationStatus];

  return (
    <Link href={`/assertion/browse/${data.id}`}>
      <m.div
        layout
        layoutId={`statement-card-${data.id}`}
        className={
          'group ring-muted-foreground/20 hover:ring-primary/50 bg-muted divide-border/50 relative flex h-auto w-full cursor-pointer flex-col gap-0 divide-y overflow-hidden ring transition-shadow duration-200'
        }
      >
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <m.h2
              layout
              layoutId={`statement-${data.id}`}
              className="group-hover:text-primary flex-1 truncate text-sm transition-colors md:text-base"
            >
              {data.statement}
            </m.h2>
            <div
              className={`flex items-center gap-1 rounded-none border px-2 py-1 font-mono text-[11px] tracking-widest whitespace-nowrap uppercase ${finalizationColor}`}
            >
              {finalizationStatus === 'finalized' && (
                <>
                  <CheckCircleIcon className="size-4" />
                  <span>Finalized</span>
                </>
              )}
              {finalizationStatus === 'optimistic' && (
                <>
                  <ClockIcon className="size-4" />
                  <span>Optimistic</span>
                </>
              )}
              {finalizationStatus === 'pending' && (
                <>
                  <WarningOctagonIcon className="size-4" />
                  <span>Pending</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground font-mono text-[11px] tracking-widest uppercase">
                Stage
              </span>
              <span className="font-mono">{stage}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground font-mono text-[11px] tracking-widest uppercase">
                Consensus
              </span>
              <span className="font-mono">{getOutcomeLabel(data.outcome)}</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {disputeLevel !== 'none' && (
                <>
                  <WarningOctagonIcon weight="fill" className="size-3.5" />
                  <span className="text-muted-foreground font-mono tabular-nums">
                    Disputes: {data.disputeCount}
                    {disputeLevel === 'llm' && ' (LLM)'}
                    {disputeLevel === 'vote' && ' (Vote)'}
                  </span>
                </>
              )}
              {disputeLevel === 'none' && (
                <span className="text-muted-foreground">No disputes</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground font-mono text-[11px] tracking-widest uppercase">
                Bond
              </span>
              <span className="text-primary font-mono tabular-nums">
                {data.bondAmountPUSD} USDC
              </span>
            </div>
          </div>
        </div>

        <div className="text-muted-foreground px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            {finalizationStatus === 'pending' && (
              <WarningOctagonIcon weight="fill" className="size-3" />
            )}
            {finalizationStatus === 'finalized' && (
              <CheckCircleIcon weight="fill" className="size-3" />
            )}
            {finalizationStatus === 'optimistic' && <ClockIcon weight="fill" className="size-3" />}
            <span>{contextualMsg}</span>
          </div>
        </div>

        <div className="px-4 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ClockIcon weight="fill" className="text-muted-foreground size-3.5" />
              <span className="text-muted-foreground font-mono tabular-nums">
                {!hydrated
                  ? '—'
                  : remainingTime === 'Expired'
                    ? 'Liveness expired'
                    : `${remainingTime} remaining`}
              </span>
            </div>

            {data.voteResolutionRound && data.voteResolutionRound.totalValidWeight > 0n && (
              <div className="flex items-center gap-2 font-mono">
                <span className="text-muted-foreground text-[11px] tracking-widest uppercase">
                  Weight locked
                </span>
                <span className="tabular-nums">
                  {Number(data.voteResolutionRound.totalValidWeight).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </m.div>
    </Link>
  );
}
