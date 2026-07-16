'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  ArrowLeftIcon,
  CheckCircleIcon,
  QuestionIcon,
  SealCheckIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { MotionConfig, motion as m } from 'motion/react';
import type { Variants } from 'motion/react';

import { Button } from '@/components/ui/button';
import { getOutcomeLabel } from '@/lib/assertion-labels';
import { MOCK_VOTE_WEIGHT, castVote, useAssertions, useUserVote } from '@/lib/assertion-store';
import { getTimeRemaining, isDeadlinePast } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { useWallet } from '@/providers/wallet-context';
import type { ResolutionOutcome, VoteResolutionRound } from '@/types';

const OUTCOME_OPTIONS: {
  outcome: ResolutionOutcome;
  icon: Icon;
  description: string;
}[] = [
  { outcome: 'True', icon: CheckCircleIcon, description: 'The statement is accurate as written.' },
  { outcome: 'False', icon: XCircleIcon, description: 'The statement is inaccurate.' },
  {
    outcome: 'Unresolvable',
    icon: QuestionIcon,
    description:
      'It cannot be decided under its Resolution Spec: ambiguous, conflicting, or premature.',
  },
];

// Entrance choreography: parents stagger their children, children rise out of a blur.
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function VoteScreen() {
  const { id } = useParams();
  const idStr = Array.isArray(id) ? id[0] : id;
  const assertions = useAssertions();
  const assertion = assertions.find((s) => s.id === idStr);

  if (!assertion || !idStr) {
    notFound();
  }

  const { ready, authenticated, currentAddress, login } = useWallet();
  const walletConnected = Boolean(ready && authenticated && currentAddress);

  const userVote = useUserVote(idStr);
  const [selected, setSelected] = useState<ResolutionOutcome | null>(null);

  // 1s ticker so the countdown and the closing deadline re-evaluate live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const round = assertion.voteResolutionRound;
  const resolved = assertion.state === 'Resolved';
  const votingClosed = isDeadlinePast(round?.votingDeadline);
  const votingLive =
    assertion.state === 'Voting' && Boolean(round?.votingDeadline) && !votingClosed;

  const backHref = `/assertion/browse/${idStr}`;

  if (userVote && round) {
    return (
      <VoteRecorded
        statement={assertion.statement}
        userVote={userVote}
        round={round}
        resolved={resolved}
        votingClosed={votingClosed}
        backHref={backHref}
      />
    );
  }

  if (!votingLive || !round) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-xl uppercase md:text-2xl">
          {resolved ? 'Assertion Resolved' : votingClosed ? 'Voting Closed' : 'Voting Not Open'}
        </h1>

        <p className="text-muted-foreground text-sm leading-relaxed">
          {resolved
            ? round
              ? 'Voting has ended and this round has already been finalized.'
              : 'This assertion resolved without a voting round.'
            : votingClosed
              ? 'The voting window has ended. The round can now be finalized.'
              : 'Votes can only be cast while the assertion is in its voting window.'}
        </p>

        <Button variant="outline" nativeButton={false} render={<Link href={backHref} />}>
          Back to Assertion
        </Button>
      </div>
    );
  }

  const handleConfirm = () => {
    if (!selected) return;
    if (!walletConnected || !currentAddress) {
      login();
      return;
    }
    castVote(idStr, selected, MOCK_VOTE_WEIGHT, currentAddress);
  };

  const confirmLabel = !selected
    ? 'Select an Outcome'
    : !walletConnected
      ? `Sign in to Vote ${getOutcomeLabel(selected)}`
      : `Confirm Vote: ${getOutcomeLabel(selected)} · ${MOCK_VOTE_WEIGHT.toLocaleString()} USDC`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col px-6 pt-24 pb-8 md:px-10">
        <m.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex w-full flex-1 flex-col"
        >
          <m.div variants={rise} className="flex items-center justify-between">
            <Link
              href={backHref}
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 font-mono text-xs tracking-widest uppercase transition-colors"
            >
              <ArrowLeftIcon size={14} />
              Back to Assertion
            </Link>

            <div className="flex flex-col items-end gap-0.5">
              <span className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
                Voting Closes In
              </span>

              <span className="text-primary font-mono text-sm uppercase tabular-nums">
                {getTimeRemaining(round.votingDeadline ?? undefined)}
              </span>
            </div>
          </m.div>

          <div className="flex flex-1 flex-col items-center justify-center gap-10 py-10">
            <m.div variants={rise} className="flex flex-col items-center gap-4 text-center">
              <span className="text-primary font-mono text-xs tracking-[0.25em] uppercase">
                Cast Your Vote
              </span>

              <h1 className="max-w-3xl text-xl leading-snug text-balance uppercase md:text-2xl">
                {assertion.statement}
              </h1>

              <div className="text-muted-foreground flex flex-wrap justify-center gap-x-8 gap-y-2 font-mono text-xs tracking-wider uppercase">
                <span>
                  LLM Proposed{' '}
                  <span className="text-foreground">
                    {getOutcomeLabel(assertion.llmResolutionRound?.outcome ?? null)}
                  </span>
                </span>

                <span>
                  Your Stake{' '}
                  <span className="text-foreground tabular-nums">
                    {MOCK_VOTE_WEIGHT.toLocaleString()} USDC
                  </span>
                </span>

                <span>
                  Total Locked{' '}
                  <span className="text-foreground tabular-nums">
                    {Number(round.totalValidWeight).toLocaleString()} USDC
                  </span>
                </span>
              </div>
            </m.div>

            <m.div
              variants={stagger}
              className="grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3"
            >
              {OUTCOME_OPTIONS.map(({ outcome, icon: OutcomeIcon, description }) => {
                const isSelected = selected === outcome;

                return (
                  <m.button
                    key={outcome}
                    variants={rise}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelected(outcome)}
                    aria-pressed={isSelected}
                    className={cn(
                      'group border-border bg-card/40 relative flex min-h-52 flex-col items-center justify-center gap-5 border p-6 text-center transition-colors md:p-8',
                      !isSelected && 'hover:border-primary/60 hover:bg-primary/5'
                    )}
                  >
                    {isSelected && (
                      <m.span
                        layoutId="vote-selection"
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="border-primary bg-primary/10 absolute -inset-px border"
                      />
                    )}

                    <m.span
                      animate={isSelected ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="relative z-10"
                    >
                      <OutcomeIcon
                        size={36}
                        weight={isSelected ? 'fill' : 'regular'}
                        className={cn(
                          'transition-colors',
                          isSelected
                            ? 'text-primary'
                            : 'text-muted-foreground group-hover:text-primary'
                        )}
                      />
                    </m.span>

                    <div className="relative z-10 flex flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          'font-mono text-lg tracking-[0.15em] uppercase md:text-xl',
                          isSelected && 'text-primary'
                        )}
                      >
                        {getOutcomeLabel(outcome)}
                      </span>

                      <span className="text-muted-foreground max-w-60 text-xs leading-relaxed">
                        {description}
                      </span>
                    </div>
                  </m.button>
                );
              })}
            </m.div>

            <m.p
              variants={rise}
              className="text-muted-foreground/60 max-w-3xl text-center text-xs leading-relaxed"
            >
              Mock stake: {MOCK_VOTE_WEIGHT.toLocaleString()} USDC. Weight is linear (1 staked USDC
              = 1 vote) and an outcome needs a supermajority or the vote settles Unresolvable. Real
              sealed MagicBlock voting is not wired yet — this only updates local state, and the
              live tally shown here would be hidden in the real protocol.
            </m.p>
          </div>

          <m.div variants={rise} className="flex flex-col gap-4">
            <div className="via-border h-px w-full bg-gradient-to-r from-transparent to-transparent" />
            <m.button
              whileHover={selected ? { scale: 1.005 } : {}}
              whileTap={selected ? { scale: 0.995 } : {}}
              disabled={!selected}
              onClick={handleConfirm}
              className={cn(
                'w-full py-4 font-mono text-xs tracking-widest uppercase transition-colors',
                selected
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
                  : 'border-border bg-muted/40 text-muted-foreground cursor-not-allowed border'
              )}
            >
              {confirmLabel}
            </m.button>
          </m.div>
        </m.div>
      </div>
    </MotionConfig>
  );
}

function VoteRecorded({
  statement,
  userVote,
  round,
  resolved,
  votingClosed,
  backHref,
}: {
  statement: string;
  userVote: ResolutionOutcome;
  round: VoteResolutionRound;
  resolved: boolean;
  votingClosed: boolean;
  backHref: string;
}) {
  const totalWeight = Number(round.totalValidWeight);

  return (
    // Same reduced-motion opt-out as the live-vote screen — this branch renders outside
    // that MotionConfig, so it needs its own.
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-24">
        <m.div
          initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full max-w-2xl flex-col items-center gap-10 text-center"
        >
          <div className="flex flex-col items-center gap-4">
            <SealCheckIcon size={48} weight="fill" className="text-primary" />

            <span className="text-muted-foreground font-mono text-xs tracking-[0.25em] uppercase">
              Vote Recorded
            </span>

            <h1 className="text-3xl uppercase md:text-4xl">
              You Voted <span className="text-primary">{getOutcomeLabel(userVote)}</span>
            </h1>

            <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">{statement}</p>

            <p className="text-muted-foreground text-xs leading-relaxed">
              {resolved
                ? 'Voting has ended and this round has been finalized.'
                : votingClosed
                  ? 'Voting has closed — the round can now be finalized.'
                  : `Voting closes in ${getTimeRemaining(round.votingDeadline ?? undefined)}.`}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 text-left">
            {(['True', 'False', 'Unresolvable'] as ResolutionOutcome[]).map((outcome) => {
              const votes = Number(round.aggregateVotes[outcome]);
              const share = totalWeight > 0 ? Math.round((votes / totalWeight) * 100) : 0;
              const isUserVote = userVote === outcome;

              return (
                <div key={outcome} className="border-border flex flex-col gap-1.5 border-b pb-2">
                  <div className="flex items-center justify-between font-mono text-sm tracking-wider uppercase">
                    <span className={cn(isUserVote && 'text-primary')}>
                      {getOutcomeLabel(outcome)}
                    </span>

                    <span className="tabular-nums">
                      {votes.toLocaleString()} · {share}%
                    </span>
                  </div>

                  <div className="bg-muted/40 h-1 w-full">
                    <div
                      className="bg-primary h-full transition-[width] duration-500 ease-out"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href={backHref} />}
          >
            <ArrowLeftIcon />
            Back to Assertion
          </Button>
        </m.div>
      </div>
    </MotionConfig>
  );
}
