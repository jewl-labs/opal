'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import DisputeAction from '@/components/assertion/dispute-action';
import Timeline from '@/components/assertion/timeline';
import VotingPanel from '@/components/assertion/voting-panel';
import Rise from '@/components/common/rise';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { getOutcomeLabel, getStageLabel } from '@/lib/assertion-labels';
import {
  finalizeAssertion,
  openVote,
  submitLlmResolution,
  useAssertions,
  useUserVote,
} from '@/lib/assertion-store';
import { getTimeRemaining, isDeadlinePast } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import type { AssertionAccount, AssertionState } from '@/types';

const DEADLINE_LABELS: Record<AssertionState, string> = {
  Asserted: 'Liveness Window',
  PendingLLM: 'Awaiting LLM',
  AssertedLLM: 'Challenge Window',
  PendingVote: 'Vote Setup',
  Voting: 'Voting Window',
  Resolved: 'Finalized',
};

const STAGE_COLORS: Record<AssertionState, string> = {
  Asserted: 'text-orange-300',
  PendingLLM: 'text-yellow-300',
  AssertedLLM: 'text-yellow-300',
  PendingVote: 'text-purple-300',
  Voting: 'text-blue-300',
  Resolved: 'text-lime-400',
};

export default function StatementPage() {
  const { id } = useParams();
  const idStr = Array.isArray(id) ? id[0] : id;
  const assertions = useAssertions();
  const assertion = assertions.find((s) => s.id === idStr);

  if (!assertion || !idStr) {
    notFound();
  }

  const userVote = useUserVote(idStr);

  const activeDeadline =
    assertion.state === 'AssertedLLM'
      ? (assertion.llmResolutionRound?.challengeDeadline ?? undefined)
      : assertion.state === 'Voting'
        ? (assertion.voteResolutionRound?.votingDeadline ?? undefined)
        : assertion.livenessDeadline;

  const [showEvidenceModal, setShowEvidenceModal] = useState(false);

  // 1s ticker so countdowns and deadline-gated actions re-evaluate live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingTime = getTimeRemaining(activeDeadline);
  const votingClosed = isDeadlinePast(assertion.voteResolutionRound?.votingDeadline);

  // Current non-final answer is inferred from state (docs/resolution.md) —
  // `outcome` is only meaningful once Resolved.
  const llmOutcome = assertion.llmResolutionRound?.outcome;
  const isResolved = assertion.state === 'Resolved';
  const consensus =
    assertion.state === 'Asserted'
      ? 'True (Optimistic)'
      : assertion.state === 'PendingLLM'
        ? 'Pending'
        : assertion.state === 'AssertedLLM'
          ? (llmOutcome ?? 'Pending')
          : assertion.state === 'PendingVote' || assertion.state === 'Voting'
            ? `${llmOutcome ?? 'Unknown'} (Challenged)`
            : getOutcomeLabel(assertion.outcome);

  const consensusColor = !isResolved
    ? 'text-lime-400'
    : assertion.outcome === 'True'
      ? 'text-lime-400'
      : assertion.outcome === 'False'
        ? 'text-red-400'
        : 'text-zinc-400';

  return (
    <div className="flex h-screen flex-col overflow-hidden pt-16">
      <header className="border-border flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-8">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
              {isResolved ? 'Final Outcome' : 'Current Consensus'}
            </span>

            <span className={cn('font-mono text-sm tracking-wider uppercase', consensusColor)}>
              {consensus}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
              Resolution Stage
            </span>

            <span
              className={cn(
                'font-mono text-sm tracking-wider uppercase',
                STAGE_COLORS[assertion.state]
              )}
            >
              {getStageLabel(assertion.state)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
              Bond Pool
            </span>

            <span className="font-mono text-sm tracking-wider uppercase tabular-nums">
              {assertion.bondAmountPUSD * (1 + assertion.disputeCount)} USDC
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
            {DEADLINE_LABELS[assertion.state]}
          </span>

          <span className="font-mono text-sm tracking-wider text-lime-400 uppercase tabular-nums">
            {assertion.finalizedAt
              ? new Date(assertion.finalizedAt).toLocaleDateString()
              : assertion.state === 'PendingLLM' || assertion.state === 'PendingVote'
                ? 'PENDING'
                : remainingTime}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto px-6 py-6">
        {/* my-auto centers the whole block vertically when it's shorter than the
            viewport, and degrades to normal scrolling when it isn't. */}
        <div className="my-auto flex w-full flex-col items-center gap-10">
          <Rise className="w-full">
            <AssertionSection
              assertion={assertion}
              onEvidenceClick={() => setShowEvidenceModal(true)}
            />
          </Rise>

          <Rise delay={0.12} className="flex w-full flex-col items-center gap-6">
            <DisputeAction
              assertion={assertion}
              userVote={userVote}
              onSubmitLlmResolution={(outcome) => submitLlmResolution(idStr, outcome)}
              onOpenVote={() => openVote(idStr)}
              onFinalize={() => finalizeAssertion(idStr)}
            />

            {(assertion.llmResolutionRound || assertion.voteResolutionRound) && (
              <div
                className={cn(
                  'grid w-full gap-6',
                  assertion.llmResolutionRound && assertion.voteResolutionRound && 'lg:grid-cols-2'
                )}
              >
                {assertion.llmResolutionRound && (
                  <LLMSection round={assertion.llmResolutionRound} />
                )}

                {assertion.voteResolutionRound && (
                  <VotingPanel
                    round={assertion.voteResolutionRound}
                    votingClosed={votingClosed}
                    userVote={userVote}
                  />
                )}
              </div>
            )}
          </Rise>
        </div>
      </div>

      <Rise delay={0.2} className="shrink-0">
        <Timeline statement={assertion} />
      </Rise>

      <Modal
        open={showEvidenceModal}
        onClose={() => setShowEvidenceModal(false)}
        title="Resolution Spec"
      >
        <div className="space-y-5 p-6">
          <div className="border-border border-l-2 pl-4">
            <p className="text-muted-foreground mb-1.5 font-mono text-[10px] tracking-[0.2em] uppercase">
              Spec Hash
            </p>
            <p className="font-mono text-sm break-all">{assertion.auxiliaryHash}</p>
          </div>

          {assertion.auxiliaryUrl && (
            <div className="border-border border-l-2 pl-4">
              <p className="text-muted-foreground mb-1.5 font-mono text-[10px] tracking-[0.2em] uppercase">
                Source
              </p>
              <Link
                href={assertion.auxiliaryUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary hover:text-primary/80 font-mono text-xs tracking-widest uppercase underline underline-offset-4 transition-colors"
              >
                Open Resolution Spec →
              </Link>
            </div>
          )}

          <p className="text-muted-foreground/75 border-border border-t pt-4 text-xs leading-relaxed">
            The asserter&apos;s Resolution Spec — the source of truth resolvers and voters use to
            decide the outcome. Only its hash is stored on-chain.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function AssertionSection({
  assertion,
  onEvidenceClick,
}: {
  assertion: AssertionAccount;
  onEvidenceClick: () => void;
}) {
  const { disputeCount } = assertion;

  return (
    <section className="flex w-full flex-col items-center gap-5 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="max-w-5xl text-2xl leading-snug text-balance uppercase md:text-4xl">
          {assertion.statement}
        </h1>

        <Button onClick={onEvidenceClick} variant="outline" size="md" className="px-6">
          View Resolution Spec
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-x-12 gap-y-4">
        <Meta label="Assertion Bond" value={`${assertion.bondAmountPUSD} USDC`} center />

        <Meta label="Disputes" value={`${disputeCount}`} center />

        <Meta label="Created" value={new Date(assertion.createdAt).toLocaleDateString()} center />
      </div>
    </section>
  );
}

function LLMSection({ round }: { round: NonNullable<AssertionAccount['llmResolutionRound']> }) {
  return (
    <Section title="LLM Resolution">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Meta label="Outcome" value={round.outcome ?? 'PENDING'} />

        <Meta
          label="Resolved At"
          value={round.resolvedAt ? new Date(round.resolvedAt).toLocaleDateString() : 'PENDING'}
        />

        <Meta
          label="Challenge Deadline"
          value={
            round.challengeDeadline
              ? new Date(round.challengeDeadline).toLocaleDateString()
              : 'NONE'
          }
        />
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border flex h-full flex-col gap-4 border p-5">
      <h2 className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
        {title}
      </h2>

      {children}
    </section>
  );
}

function Meta({
  label,
  value,
  center = false,
}: {
  label: string;
  value: string;
  center?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-1', center && 'items-center')}>
      <span className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
        {label}
      </span>

      <span className="font-mono text-sm break-all uppercase tabular-nums">{value}</span>
    </div>
  );
}
