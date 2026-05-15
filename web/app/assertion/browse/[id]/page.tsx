'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LinkBreakIcon, XIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion as m } from 'motion/react';

import Timeline from '@/components/assertion/timeline';
import Container from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ASSERTIONS } from '@/data/assertion';
import { getTimeRemaining } from '@/lib/helpers';
import type { ResolutionOutcome } from '@/types';

export default function StatementPage() {
  const { id } = useParams();

  const assertion = ASSERTIONS.find((s) => s.id === id);

  if (!assertion) {
    notFound();
  }

  const [remainingTime, setRemainingTime] = useState(() =>
    getTimeRemaining(assertion.livenessDeadline)
  );

  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [userVote, setUserVote] = useState<ResolutionOutcome | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime(getTimeRemaining(assertion.livenessDeadline));
    }, 1000);

    return () => clearInterval(interval);
  }, [assertion.livenessDeadline]);

  const handleDispute = () => {
    if (disputeReason.trim()) {
      setDisputeReason('');
      setShowDisputeModal(false);
    }
  };

  return (
    <Container className="border-muted-foreground/50 border-x border-dashed py-16">
      <header className="border-foreground/40 flex h-16 items-center justify-between border-b border-dashed px-4">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[10px] uppercase">Current Consensus</span>

            <span className="text-sm font-semibold text-lime-400 uppercase">
              {assertion.state === 'Asserted'
                ? `${assertion.outcome} (OPTIMISTIC)`
                : assertion.outcome}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-muted-foreground text-[10px] uppercase">Resolution Stage</span>

            <span className="text-sm font-semibold text-orange-300 uppercase">
              {assertion.state}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-muted-foreground text-[10px] uppercase">Bond Pool</span>

            <span className="text-sm font-semibold uppercase">
              {assertion.bondAmountPUSD * (1 + assertion.disputeCount)} PUSD
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-muted-foreground text-[10px] uppercase">
            {assertion.finalizedAt ? 'Finalized' : 'Challenge Window'}
          </span>

          <span className="text-sm font-semibold text-lime-400 uppercase">
            {assertion.finalizedAt
              ? new Date(assertion.finalizedAt).toLocaleDateString()
              : remainingTime}
          </span>
        </div>
      </header>

      <div className="flex flex-col justify-between gap-12 px-4 py-8 lg:flex-row">
        <div className="flex max-w-4xl flex-1 flex-col gap-10">
          <AssertionSection
            statement={assertion.statement}
            outcome={assertion.outcome}
            state={assertion.state}
            disputeCount={assertion.disputeCount}
            bondAmount={assertion.bondAmountPUSD}
            createdAt={assertion.createdAt}
            finalizedAt={assertion.finalizedAt}
            llmOutcome={assertion.llmResolutionRound?.outcome}
            voteWeight={assertion.voteResolutionRound?.totalValidWeight}
            onDisputeClick={() => setShowDisputeModal(true)}
            onEvidenceClick={() => setShowEvidenceModal(true)}
          />

          <EconomicsSection assertion={assertion} />

          <EvidenceSection
            auxiliaryUrl={assertion.auxiliaryUrl ?? ''}
            auxiliaryHash={assertion.auxiliaryHash}
            onViewEvidence={() => setShowEvidenceModal(true)}
          />

          {assertion.llmResolutionRound && <LLMSection round={assertion.llmResolutionRound} />}

          {assertion.voteResolutionRound && (
            <VotingSection
              round={assertion.voteResolutionRound}
              state={assertion.state}
              userVote={userVote}
              onVote={setUserVote}
            />
          )}
        </div>

        <Timeline statement={assertion} />
      </div>

      {/* Evidence Modal */}
      <AnimatePresence>
        {showEvidenceModal && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEvidenceModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <m.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background border-muted-foreground/30 relative mx-4 max-h-96 w-full max-w-2xl overflow-y-auto rounded-md border p-6"
            >
              <div className="via-primary/70 pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent to-transparent" />
              <button
                onClick={() => setShowEvidenceModal(false)}
                className="text-muted-foreground hover:text-foreground absolute top-4 right-4 transition-colors"
              >
                <XIcon size={20} />
              </button>

              <h2 className="mb-4 text-lg font-semibold uppercase">Auxiliary Evidence</h2>

              <div className="space-y-4">
                <div>
                  <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                    Evidence Hash
                  </p>
                  <p className="font-mono text-sm break-all">{assertion.auxiliaryHash}</p>
                </div>

                <div>
                  <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                    Source
                  </p>
                  {assertion.auxiliaryUrl && (
                    <Link
                      href={assertion.auxiliaryUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary hover:text-primary/80 text-sm uppercase underline transition-colors"
                    >
                      Open Evidence Source →
                    </Link>
                  )}
                </div>

                <div className="text-muted-foreground/75 pt-2 text-xs leading-relaxed">
                  Auxiliary evidence supplied by the asserter to guide LLM and voting
                  interpretation.
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Dispute Modal */}
      <AnimatePresence>
        {showDisputeModal && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDisputeModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <m.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background border-muted-foreground/30 relative mx-4 max-h-96 w-full max-w-2xl overflow-y-auto rounded-md border p-6"
            >
              <div className="via-primary/70 pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent to-transparent" />
              <button
                onClick={() => setShowDisputeModal(false)}
                className="text-muted-foreground hover:text-foreground absolute top-4 right-4 transition-colors"
              >
                <XIcon size={20} />
              </button>

              <h2 className="mb-4 text-lg font-semibold uppercase">Dispute Statement</h2>

              <div className="space-y-4">
                <div>
                  <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                    Assertion
                  </p>
                  <p className="text-sm leading-relaxed">{assertion.statement}</p>
                </div>

                <div>
                  <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                    Your Reason for Dispute
                  </p>
                  <Textarea
                    placeholder="Explain why you believe this assertion is incorrect..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="min-h-24 resize-none text-sm"
                  />
                  <p className="text-muted-foreground/60 mt-2 text-xs">
                    {disputeReason.length} characters
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => setShowDisputeModal(false)}
                    variant="outline"
                    className="flex-1 rounded-none uppercase"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDispute}
                    disabled={!disputeReason.trim()}
                    className="flex-1 rounded-none uppercase"
                  >
                    Stake Bond & Dispute
                  </Button>
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </Container>
  );
}

function AssertionSection({
  statement,
  outcome,
  state,
  disputeCount,
  bondAmount,
  createdAt,
  finalizedAt,
  llmOutcome,
  voteWeight,
  onDisputeClick,
  onEvidenceClick,
}: {
  statement: string;
  outcome?: ResolutionOutcome | null;
  state: string;
  disputeCount: number;
  bondAmount: number;
  createdAt: string;
  finalizedAt: string | null;
  llmOutcome?: ResolutionOutcome | null;
  voteWeight?: bigint | null;
  onDisputeClick: () => void;
  onEvidenceClick: () => void;
}) {
  const stageMap: Record<string, string> = {
    Asserted: 'OPTIMISTIC',
    PendingLLM: 'AWAITING LLM',
    AssertedLLM: 'LLM RESOLVED',
    PendingVote: 'PREPARING VOTE',
    Voting: 'VOTING LIVE',
    Resolved: 'FINALIZED',
  };

  const isFinal = state === 'Resolved';

  const consensus =
    state === 'Asserted' ? `${outcome ?? 'Unknown'} (OPTIMISTIC)` : (outcome ?? 'Pending');

  const finalStatus = isFinal ? 'FINALIZED' : 'PENDING';

  const bondPool = bondAmount * (1 + disputeCount);

  let protocolMessage = '';

  if (state === 'Asserted') {
    protocolMessage = 'assertion is currently within optimistic liveness window.';
  }

  if (state === 'PendingLLM') {
    protocolMessage = 'assertion disputed. awaiting llm resolution.';
  }

  if (state === 'AssertedLLM') {
    protocolMessage = `llm proposed ${llmOutcome?.toUpperCase() ?? 'Unknown'}. challenge window active.`;
  }

  if (state === 'PendingVote') {
    protocolMessage = 'llm resolution challenged. vote initialization pending.';
  }

  if (state === 'Voting') {
    protocolMessage = `${Number(voteWeight || 0).toLocaleString()} opal voting weight currently active.`;
  }

  if (state === 'Resolved') {
    protocolMessage = `finalized via ${
      disputeCount === 2 ? 'voting' : disputeCount === 1 ? 'llm' : 'optimistic'
    } resolution.`;
  }

  const canDispute = state !== 'Resolved';

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight uppercase md:text-5xl">
          {statement}
        </h1>

        <div className="flex items-center gap-4">
          <Button
            onClick={onDisputeClick}
            disabled={!canDispute}
            variant={canDispute ? 'destructive' : 'outline'}
            className="rounded-none uppercase"
          >
            <LinkBreakIcon />
            {canDispute ? 'Dispute Statement' : 'Dispute Closed'}
          </Button>

          <Button onClick={onEvidenceClick} variant="outline" className="rounded-none uppercase">
            View Evidence
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-12 gap-y-6 md:grid-cols-3">
        <Meta label="Current Consensus" value={consensus} />

        <Meta label="Final Status" value={finalStatus} />

        <Meta label="Resolution Stage" value={stageMap[state] ?? 'Unknown'} />

        <Meta label="Disputes" value={`${disputeCount} ACTIVE`} />

        <Meta label="Bond Pool" value={`${bondPool} PUSD`} />

        <Meta label="Created" value={new Date(createdAt).toLocaleDateString()} />

        {finalizedAt && (
          <Meta label="Finalized" value={new Date(finalizedAt).toLocaleDateString()} />
        )}

        {llmOutcome && <Meta label="LLM Resolution" value={llmOutcome} />}

        {voteWeight !== undefined && voteWeight !== null && (
          <Meta label="Voting Weight" value={`${Number(voteWeight).toLocaleString()} OPAL`} />
        )}
      </div>

      <div className="border-muted-foreground/20 flex flex-col gap-2 border-t border-dashed pt-8">
        <span className="text-muted-foreground text-xs uppercase">
          Current Protocol Interpretation
        </span>

        <p className="text-sm leading-relaxed font-medium uppercase">{protocolMessage}</p>
      </div>
    </section>
  );
}

function EconomicsSection({ assertion }: { assertion: any }) {
  const totalBondPool = assertion.bondAmountPUSD * (1 + assertion.disputeCount);

  return (
    <Section title="Economics">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Meta label="Assertion Bond" value={`${assertion.bondAmountPUSD} PUSD`} />

        <Meta label="Dispute Count" value={`${assertion.disputeCount}`} />

        <Meta label="Total Bond Pool" value={`${totalBondPool} PUSD`} />

        <Meta label="Settlement" value={assertion.finalizedAt ? 'FINALIZED' : 'PENDING'} />
      </div>
    </Section>
  );
}

function EvidenceSection({
  auxiliaryUrl,
  auxiliaryHash,
  onViewEvidence,
}: {
  auxiliaryUrl: string;
  auxiliaryHash: string;
  onViewEvidence: () => void;
}) {
  return (
    <Section title="Auxiliary Evidence">
      <div className="flex flex-col gap-4">
        <Meta label="Evidence Hash" value={auxiliaryHash} />

        <div className="flex gap-3">
          <Button
            onClick={onViewEvidence}
            variant="outline"
            className="rounded-none text-sm uppercase"
          >
            View Evidence
          </Button>
        </div>

        <p className="text-muted-foreground text-sm leading-relaxed uppercase">
          auxiliary evidence supplied by the asserter to guide llm and voting interpretation.
        </p>
      </div>
    </Section>
  );
}

function LLMSection({ round }: { round: any }) {
  return (
    <Section title="LLM Resolution">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Meta label="Outcome" value={round.outcome} />

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

        <Meta label="Prompt Hash" value={`${round.promptHash.slice(0, 12)}...`} />
      </div>
    </Section>
  );
}

function VotingSection({
  round,
  state,
  userVote,
  onVote,
}: {
  round: any;
  state: string;
  userVote: ResolutionOutcome | null;
  onVote: (outcome: ResolutionOutcome) => void;
}) {
  const isVotingActive = state === 'Voting';
  const outcomes: ResolutionOutcome[] = ['True', 'False', 'TooEarly', 'Unresolvable'];

  const handleVote = (outcome: ResolutionOutcome) => {
    onVote(outcome);
    console.log('Vote submitted:', { outcome });
  };

  return (
    <Section title="Voting">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Meta
          label="Voting Weight"
          value={`${Number(round.totalValidWeight).toLocaleString()} OPAL`}
        />

        <Meta label="Leading Outcome" value={round.finalOutcome || 'Pending'} />

        <Meta
          label="Voting Opens"
          value={
            round.votingStartsAt ? new Date(round.votingStartsAt).toLocaleDateString() : 'PENDING'
          }
        />

        <Meta
          label="Voting Deadline"
          value={
            round.votingDeadline ? new Date(round.votingDeadline).toLocaleDateString() : 'PENDING'
          }
        />
      </div>

      {isVotingActive && (
        <div className="flex flex-col gap-4 py-4">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Cast Your Vote</p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {outcomes.map((outcome) => (
              <Button
                key={outcome}
                onClick={() => handleVote(outcome)}
                variant={userVote === outcome ? 'default' : 'outline'}
                className="rounded-none text-sm uppercase transition-colors"
              >
                {outcome === 'TooEarly'
                  ? 'Too Early'
                  : outcome === 'Unresolvable'
                    ? 'Unresolvable'
                    : outcome}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">Aggregate Votes</p>
        {Object.entries(round.aggregateVotes).map(([key, value]) => (
          <div
            key={key}
            className="flex items-center justify-between border-b border-dashed pb-2 text-sm uppercase"
          >
            <span>
              {key === 'TooEarly' ? 'Too Early' : key === 'Unresolvable' ? 'Unresolvable' : key}
            </span>

            <span className="font-mono font-semibold">{Number(value).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-muted-foreground/20 flex flex-col gap-6 border-t border-dashed pt-8">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
        {title}
      </h2>

      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs uppercase">{label}</span>

      <span className="text-sm font-semibold break-all uppercase">{value}</span>
    </div>
  );
}
