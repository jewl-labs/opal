'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { filterAssertionsByAddress } from '@/data/assertion';
import { computeAssertionStats } from '@/lib/assertion-stats';

type VoteStatus = 'ALL' | 'ACTIVE' | 'ALIGNED' | 'MISALIGNED';

interface VoteView {
  id: string;
  assertionId: string;
  statement: string;
  voteWeight: string;
  currentConsensus: string;
  status: Exclude<VoteStatus, 'ALL'>;
  reward?: string;
  date: string;
}

// Derive votes from assertions with voteResolutionRound
function deriveVotes(assertions: any[]): VoteView[] {
  const votes: VoteView[] = [];

  assertions.forEach((a) => {
    if (a.voteResolutionRound) {
      const totalVotes = (Object.values(a.voteResolutionRound.aggregateVotes) as number[]).reduce(
        (sum, v) => sum + v,
        0
      );
      const userVoteWeight =
        totalVotes > 0
          ? ((Number(a.voteResolutionRound.totalValidWeight) / totalVotes) * 100).toFixed(1)
          : '0';

      // Determine status: guard against null/undefined votingDeadline
      const isActive =
        !a.voteResolutionRound.votingDeadline ||
        new Date(a.voteResolutionRound.votingDeadline).getTime() > Date.now();
      const status: Exclude<VoteStatus, 'ALL'> = isActive ? 'ACTIVE' : 'ALIGNED';

      votes.push({
        id: `${a.id}-vote`,
        assertionId: a.id,
        statement: a.statement,
        voteWeight: `${userVoteWeight}%`,
        currentConsensus: (a.voteResolutionRound.finalOutcome || a.outcome) as string,
        status,
        reward: a.voteResolutionRound.finalOutcome
          ? `+${Math.floor(Number(a.voteResolutionRound.totalValidWeight) / 100)} OPAL`
          : undefined,
        date: a.createdAt,
      });
    }
  });

  return votes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const FILTERS: { label: string; value: VoteStatus }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'ALIGNED', value: 'ALIGNED' },
  { label: 'MISALIGNED', value: 'MISALIGNED' },
];

const STATUS_META: Record<
  Exclude<VoteStatus, 'ALL'>,
  { label: string; dot: string; text: string }
> = {
  ACTIVE: { label: 'ACTIVE', dot: 'bg-purple-400', text: 'text-purple-400' },
  ALIGNED: { label: 'ALIGNED', dot: 'bg-primary', text: 'text-primary' },
  MISALIGNED: { label: 'MISALIGNED', dot: 'bg-red-400', text: 'text-red-400' },
};

const OUTCOME_COLOR: Record<string, string> = {
  TRUE: 'text-primary',
  FALSE: 'text-red-400',
  'TOO EARLY': 'text-cyan-400',
  UNRESOLVABLE: 'text-zinc-400',
};

export default function VotesPage() {
  const params = useParams<{ address: string }>();
  const address = Array.isArray(params?.address) ? params.address[0] : params?.address;
  const assertions = filterAssertionsByAddress(address);
  const [filter, setFilter] = useState<VoteStatus>('ALL');
  const [search, setSearch] = useState('');

  const votes = deriveVotes(assertions as any);
  const stats = computeAssertionStats(assertions as any);

  const rows = votes.filter((v) => {
    const matchFilter = filter === 'ALL' || v.status === filter;
    const matchSearch = !search || v.statement.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const countByStatus = (status: VoteStatus): number => {
    if (status === 'ALL') return votes.length;
    return votes.filter((v) => v.status === status).length;
  };

  const totalReward = votes
    .filter((v) => v.reward)
    .reduce((sum, v) => {
      if (!v.reward) return sum;
      return sum + parseFloat(v.reward.replace('+', '').replace(' OPAL', ''));
    }, 0);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* status bar */}
      <div className="border-muted-foreground/20 flex flex-wrap items-center gap-6 border-b border-dashed py-3 text-[10px] tracking-widest uppercase">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">Total Assertions</div>
          <div className="text-primary text-[10px] font-semibold">{stats.totalAssertions}</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">Disputes</div>
          <div className="text-primary text-[10px] font-semibold">{stats.totalDisputes}</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">Active</div>
          <div className="text-primary text-[10px] font-semibold">{stats.activeAssertions}</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-muted-foreground">Total Rewards</div>
          <div className="text-primary text-[10px] font-semibold">+{totalReward} OPAL</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">Bond PUSD</div>
          <div className="text-[10px] font-semibold">{stats.totalBondPUSD}</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">OPAL Locked</div>
          <div className="text-[10px] font-semibold">
            {Intl.NumberFormat().format(stats.totalValidWeight || 0)}
          </div>
        </div>
      </div>

      {/* filter + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-0">
          {FILTERS.map((f) => {
            const isActive = filter === f.value;
            const count = countByStatus(f.value);
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`flex items-center gap-1.5 border border-dashed px-3 py-1.5 text-[10px] tracking-widest uppercase transition-colors ${
                  isActive
                    ? 'border-primary/60 bg-primary/10 text-primary'
                    : 'border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
                }`}
              >
                {f.label}
                <span
                  className={`px-1 text-[9px] ${isActive ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <input
          type="text"
          placeholder="SEARCH..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-muted-foreground/30 placeholder:text-muted-foreground/40 focus:border-primary/50 h-8 w-48 border border-dashed bg-transparent px-3 text-[10px] tracking-wider uppercase focus:outline-none"
        />
      </div>

      {/* table */}
      <section className="border-muted-foreground/30 bg-muted/5 border border-dashed">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-muted-foreground/20 border-b border-dashed text-left">
                <th className="text-muted-foreground w-[45%] px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Assertion
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Consensus
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Weight
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Status
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Reward
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-muted-foreground/30 py-16 text-center text-xs uppercase"
                  >
                    No votes found
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const { dot, text } = STATUS_META[row.status];

                  return (
                    <tr
                      key={row.id}
                      className="group border-muted-foreground/10 hover:bg-muted/10 border-b border-dashed transition-colors last:border-none"
                    >
                      {/* statement */}
                      <td className="w-[45%] px-5 py-4">
                        <Link
                          href={`/assertion/browse/${row.assertionId}`}
                          className="group-hover:text-primary line-clamp-1 text-xs tracking-tight uppercase transition-colors"
                        >
                          {row.statement}
                        </Link>
                      </td>

                      {/* consensus */}
                      <td
                        className={`px-5 py-4 text-[10px] font-semibold uppercase ${OUTCOME_COLOR[row.currentConsensus] ?? 'text-muted-foreground'}`}
                      >
                        {row.currentConsensus}
                      </td>

                      {/* weight */}
                      <td className="text-muted-foreground px-5 py-4 text-[10px] uppercase">
                        {row.voteWeight}
                      </td>

                      {/* status */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
                          <span className={`text-[10px] tracking-wide uppercase ${text}`}>
                            {STATUS_META[row.status].label}
                          </span>
                        </div>
                      </td>

                      {/* reward */}
                      <td className="px-5 py-4 text-[10px] font-semibold uppercase">
                        {row.reward ? (
                          <span className="text-primary">{row.reward}</span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
