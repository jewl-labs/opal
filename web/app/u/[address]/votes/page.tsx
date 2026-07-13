'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { motion as m } from 'motion/react';

import Rise from '@/components/common/rise';
import { votesByAddress } from '@/data/assertion';
import { getOutcomeLabel } from '@/lib/assertion-labels';
import { useAssertions } from '@/lib/assertion-store';
import type { ResolutionOutcome } from '@/types';

// Primary status: a vote is ACTIVE until its assertion resolves (results out), then
// SETTLED. Alignment (did the voter back the winning outcome?) only exists once settled,
// so it is a secondary sub-filter — never a primary status.
type Status = 'ACTIVE' | 'SETTLED';
type StatusFilter = 'ALL' | Status;
type AlignFilter = 'ALL' | 'ALIGNED' | 'MISALIGNED';

interface VoteView {
  id: string;
  assertionId: string;
  statement: string;
  myOutcome: ResolutionOutcome;
  weight: number;
  status: Status;
  aligned: boolean | null; // null while ACTIVE
  reward: number | null;
  date: string;
  timestamp: number;
}

// Aligned voters earn a proportional reward on their stake (mock: 10%).
function voteReward(weight: number) {
  return Math.floor(weight / 10);
}

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'SETTLED', value: 'SETTLED' },
];

const ALIGN_FILTERS: { label: string; value: AlignFilter }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'ALIGNED', value: 'ALIGNED' },
  { label: 'MISALIGNED', value: 'MISALIGNED' },
];

const OUTCOME_COLOR: Record<ResolutionOutcome, string> = {
  True: 'text-primary',
  False: 'text-red-400',
  Unresolvable: 'text-zinc-400',
};

export default function VotesPage() {
  const params = useParams<{ address: string }>();
  const address = Array.isArray(params?.address) ? params.address[0] : params?.address;
  // Votes are scoped by the per-voter records on each round, not by assertion ownership.
  const entries = votesByAddress(address, useAssertions());

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [alignFilter, setAlignFilter] = useState<AlignFilter>('ALL');
  const [search, setSearch] = useState('');

  const votes: VoteView[] = entries
    .map((e): VoteView => {
      const settled = e.assertion.state === 'Resolved';
      const aligned = settled ? e.outcome === e.assertion.outcome : null;
      return {
        id: `${e.assertion.id}-vote`,
        assertionId: e.assertion.id,
        statement: e.assertion.statement,
        myOutcome: e.outcome,
        weight: e.weight,
        status: settled ? 'SETTLED' : 'ACTIVE',
        aligned,
        reward: aligned ? voteReward(e.weight) : null,
        date: e.assertion.createdAt,
        timestamp: new Date(e.assertion.createdAt).getTime(),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const rows = votes.filter((v) => {
    const matchStatus = statusFilter === 'ALL' || v.status === statusFilter;
    const matchAlign =
      alignFilter === 'ALL' ||
      (v.status === 'SETTLED' && v.aligned === (alignFilter === 'ALIGNED'));
    const matchSearch = !search || v.statement.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchAlign && matchSearch;
  });

  const activeCount = votes.filter((v) => v.status === 'ACTIVE').length;
  const settledCount = votes.filter((v) => v.status === 'SETTLED').length;
  const alignedCount = votes.filter((v) => v.aligned === true).length;
  const totalRewards = votes.reduce((sum, v) => sum + (v.reward ?? 0), 0);

  const statusCount = (value: StatusFilter) =>
    value === 'ALL' ? votes.length : votes.filter((v) => v.status === value).length;

  // Alignment only applies to settled votes, so hide the sub-filter when browsing ACTIVE.
  const showAlignFilter = statusFilter !== 'ACTIVE';

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Rise>
        <div className="border-muted-foreground/20 flex flex-wrap items-center gap-6 border-b py-3 font-mono text-xs tracking-widest uppercase">
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">Votes Cast</div>
            <div className="text-primary tabular-nums">{votes.length}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">Active</div>
            <div className="text-purple-400 tabular-nums">{activeCount}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">Settled</div>
            <div className="tabular-nums">{settledCount}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">Aligned</div>
            <div className="text-primary tabular-nums">
              {alignedCount}/{settledCount}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="text-muted-foreground">Rewards</div>
            <div className="text-primary tabular-nums">
              +{Intl.NumberFormat().format(totalRewards)} USDC
            </div>
          </div>
        </div>
      </Rise>

      <Rise delay={0.08}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((f) => {
                const isActive = statusFilter === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`relative flex items-center gap-1.5 rounded-none px-3 py-1.5 font-mono text-xs tracking-widest uppercase transition-colors ${
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground hover:bg-muted-foreground/5 hover:text-foreground'
                    }`}
                  >
                    {isActive && (
                      <m.span
                        layoutId="filter-pill"
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="bg-primary/10 ring-primary/20 absolute inset-0 ring-1"
                      />
                    )}
                    <span className="relative z-10">{f.label}</span>
                    <span
                      className={`relative z-10 px-1 font-mono text-xs tabular-nums ${isActive ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'}`}
                    >
                      {statusCount(f.value)}
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
              className="bg-muted/10 border-muted-foreground/20 placeholder:text-muted-foreground/40 focus:ring-primary/40 h-10 w-full rounded-none border px-4 font-mono text-sm tracking-widest uppercase focus:ring-1 focus:outline-none sm:w-80"
            />
          </div>

          {showAlignFilter && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground/50 font-mono text-[10px] tracking-[0.2em] uppercase">
                Alignment
              </span>
              <div className="flex gap-1">
                {ALIGN_FILTERS.map((f) => {
                  const isActive = alignFilter === f.value;
                  return (
                    <button
                      key={f.value}
                      onClick={() => setAlignFilter(f.value)}
                      className={`border px-2.5 py-1 font-mono text-[10px] tracking-widest uppercase transition-colors ${
                        isActive
                          ? 'border-primary/40 text-primary bg-primary/10'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Rise>

      <Rise delay={0.16} className="flex flex-1 flex-col">
        <section className="border-muted-foreground/30 bg-muted/5 flex flex-1 flex-col border">
          <div className="flex flex-1 flex-col overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-muted-foreground/20 border-b text-left">
                  <th className="text-muted-foreground w-[45%] px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    Assertion
                  </th>
                  <th className="text-muted-foreground px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    My Vote
                  </th>
                  <th className="text-muted-foreground px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    Stake
                  </th>
                  <th className="text-muted-foreground px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    Status
                  </th>
                  <th className="text-muted-foreground px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    Reward
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <m.tr
                    layout
                    key={row.id}
                    className="group border-muted-foreground/10 hover:bg-muted/10 border-b transition-colors last:border-none"
                  >
                    <td className="w-[45%] px-5 py-4">
                      <Link
                        href={`/assertion/browse/${row.assertionId}`}
                        className="group-hover:text-primary line-clamp-1 text-sm transition-colors"
                      >
                        {row.statement}
                      </Link>
                    </td>

                    <td
                      className={`px-5 py-4 font-mono text-xs tracking-widest uppercase ${OUTCOME_COLOR[row.myOutcome]}`}
                    >
                      {getOutcomeLabel(row.myOutcome)}
                    </td>

                    <td className="text-muted-foreground px-5 py-4 font-mono text-xs tabular-nums">
                      {Intl.NumberFormat().format(row.weight)} USDC
                    </td>

                    <td className="px-5 py-4">
                      {row.status === 'ACTIVE' ? (
                        <div className="flex items-center gap-2">
                          <span className="size-1.5 shrink-0 rounded-full bg-purple-400" />
                          <span className="font-mono text-xs tracking-widest text-purple-400 uppercase">
                            Active
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${row.aligned ? 'bg-primary' : 'bg-red-400'}`}
                          />
                          <span
                            className={`font-mono text-xs tracking-widest uppercase ${row.aligned ? 'text-primary' : 'text-red-400'}`}
                          >
                            {row.aligned ? 'Aligned' : 'Misaligned'}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 font-mono text-xs tracking-widest uppercase tabular-nums">
                      {row.reward !== null ? (
                        <span className="text-primary">
                          +{Intl.NumberFormat().format(row.reward)} USDC
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  </m.tr>
                ))}
              </tbody>
            </table>

            {rows.length === 0 && (
              <div className="flex flex-1 items-center justify-center py-16">
                <span className="text-muted-foreground/50 font-mono text-sm tracking-[0.25em] uppercase">
                  No votes found
                </span>
              </div>
            )}
          </div>
        </section>
      </Rise>
    </div>
  );
}
