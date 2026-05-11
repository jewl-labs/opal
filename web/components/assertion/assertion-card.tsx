'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CheckCircleIcon, ClockIcon, WarningOctagonIcon } from '@phosphor-icons/react';
import { motion as m } from 'motion/react';

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
  const [remainingTime, setRemainingTime] = useState(() => getTimeRemaining(data.livenessDeadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime(getTimeRemaining(data.livenessDeadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [data.livenessDeadline]);

  const finalizationStatus = getFinalizationStatus(data);
  const disputeLevel = getDisputeLevel(data);
  const contextualMsg = getContextualMessage(data);
  const stage = getStageLabel(data.state);

  // Color coding for finalization status
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
          'group ring-muted-foreground/20 hover:ring-muted-foreground/40 bg-muted hover:bg-accent relative flex h-auto w-full cursor-pointer flex-col gap-0 overflow-hidden ring transition-all duration-200 ease-in-out hover:shadow-md'
        }
      >
        {/* Row 1: Statement + Finalization Badge */}
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <m.h2
              layout
              layoutId={`statement-${data.id}`}
              className="flex-1 truncate text-sm font-bold tracking-tight md:text-base"
            >
              {data.statement}
            </m.h2>
            <div
              className={`flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium tracking-tighter whitespace-nowrap ${finalizationColor}`}
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

        {/* Row 2: Stage + Consensus */}
        <div className="px-4 py-2.5 text-xs tracking-tight">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">Stage:</span>
              <span className="font-mono font-semibold">{stage}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">Consensus:</span>
              <span className="font-mono font-semibold">{getOutcomeLabel(data.outcome)}</span>
            </div>
          </div>
        </div>

        {/* Row 3: Dispute & Economic Metadata */}
        <div className="px-4 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {disputeLevel !== 'none' && (
                <>
                  <WarningOctagonIcon weight="fill" className="size-3.5" />
                  <span className="text-muted-foreground">
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
              <span className="text-muted-foreground">Bond:</span>
              <span className="font-mono font-semibold text-amber-400">
                {data.bondAmountPUSD} PUSD
              </span>
            </div>
          </div>
        </div>

        {/* Row 4: Contextual Message */}
        <div className="px-4 py-2.5 text-xs font-medium tracking-wide">
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

        {/* Row 5: Timing Context */}
        <div className="px-4 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ClockIcon weight="fill" className="text-muted-foreground size-3.5" />
              <span className="text-muted-foreground">
                {remainingTime === 'Expired' ? 'Liveness expired' : `${remainingTime} remaining`}
              </span>
            </div>

            {/* Voting Weight Display */}
            {data.voteResolutionRound && data.voteResolutionRound.totalValidWeight > 0n && (
              <div className="flex items-center gap-2 font-mono">
                <span className="text-muted-foreground">Weight locked:</span>
                <span className="font-semibold">
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
