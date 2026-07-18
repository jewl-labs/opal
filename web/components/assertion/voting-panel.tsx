'use client';

import { getOutcomeLabel } from '@/lib/assertion-labels';
import { getTimeRemaining } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import type { ResolutionOutcome, VoteResolutionRound } from '@/types';

const OUTCOMES: ResolutionOutcome[] = ['True', 'False', 'Unresolvable'];

interface VotingPanelProps {
  round: VoteResolutionRound;
  votingClosed: boolean;
  userVote: ResolutionOutcome | null;
}

// Read-only tally record. Casting happens on the dedicated vote screen
// (/assertion/browse/[id]/vote) — this only summarizes the round.
export default function VotingPanel({ round, votingClosed, userVote }: VotingPanelProps) {
  const totalWeight = Number(round.totalValidWeight);

  return (
    <section className="border-border flex h-full flex-col gap-4 border p-5">
      <h2 className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
        Vote Tally
      </h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Meta label="Total Stake Locked" value={`${totalWeight.toLocaleString()} USDC`} />

        <Meta
          label={round.finalOutcome && votingClosed ? 'Final Outcome' : 'Provisional Outcome'}
          value={round.finalOutcome ? getOutcomeLabel(round.finalOutcome) : 'Pending'}
        />

        <Meta
          label="Voting Opens"
          value={
            round.votingStartsAt ? new Date(round.votingStartsAt).toLocaleDateString() : 'PENDING'
          }
        />

        <Meta
          label="Voting Deadline"
          value={
            round.votingDeadline
              ? votingClosed
                ? 'CLOSED'
                : getTimeRemaining(round.votingDeadline)
              : 'PENDING'
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        {OUTCOMES.map((outcome) => {
          const votes = Number(round.aggregateVotes[outcome]);
          const share = totalWeight > 0 ? Math.round((votes / totalWeight) * 100) : 0;
          const isUserVote = userVote === outcome;

          return (
            <div key={outcome} className="border-border flex flex-col gap-1.5 border-b pb-2">
              <div className="flex items-center justify-between font-mono text-sm tracking-wider uppercase">
                <span className={cn(isUserVote && 'text-primary')}>
                  {getOutcomeLabel(outcome)}
                  {isUserVote && (
                    <span className="text-primary/80 ml-2 text-xs tracking-[0.2em]">Your Vote</span>
                  )}
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

      <p className="text-muted-foreground/60 text-xs leading-relaxed">
        Mock tally — real votes are sealed during the voting window (only the aggregate outcome is
        committed on-chain), and an outcome needs a supermajority or the vote settles Unresolvable.
      </p>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
        {label}
      </span>

      <span className="font-mono text-sm break-all uppercase tabular-nums">{value}</span>
    </div>
  );
}
