'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { motion as m } from 'motion/react';

import Rise from '@/components/common/rise';
import { filterAssertionsByAddress } from '@/data/assertion';
import { getOutcomeLabel } from '@/lib/assertion-labels';
import { useAssertions } from '@/lib/assertion-store';
import { getTimeRemaining } from '@/lib/helpers';
import type { AssertionAccount, AssertionState, ResolutionOutcome } from '@/types';

type AssertionStateFilter = 'ALL' | 'ASSERTED' | 'LLM_DISPUTE' | 'VOTING' | 'RESOLVED';

interface AssertionView {
  id: string;
  statement: string;
  state: Exclude<AssertionStateFilter, 'ALL'>;
  outcome: ResolutionOutcome | null;
  disputes: number;
  bondUSDC: number;
  createdAt: string;
  expiresIn?: string;
}

const STATE_FILTER_MAP: Record<AssertionState, Exclude<AssertionStateFilter, 'ALL'>> = {
  Asserted: 'ASSERTED',
  PendingLLM: 'LLM_DISPUTE',
  AssertedLLM: 'LLM_DISPUTE',
  PendingVote: 'VOTING',
  Voting: 'VOTING',
  Resolved: 'RESOLVED',
};

function deriveAssertions(assertions: AssertionAccount[]): AssertionView[] {
  return assertions.map((a) => ({
    id: a.id,
    statement: a.statement,
    state: STATE_FILTER_MAP[a.state],
    // Outcome is only meaningful once the assertion is resolved.
    outcome: a.state === 'Resolved' ? a.outcome : null,
    disputes: a.disputeCount,
    bondUSDC: a.bondAmountPUSD,
    createdAt: new Date(a.createdAt).toLocaleDateString(),
    expiresIn: getTimeRemaining(a.livenessDeadline),
  }));
}

const FILTERS: { label: string; value: AssertionStateFilter }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'ASSERTED', value: 'ASSERTED' },
  { label: 'LLM DISPUTE', value: 'LLM_DISPUTE' },
  { label: 'VOTING', value: 'VOTING' },
  { label: 'RESOLVED', value: 'RESOLVED' },
];

const STATE_META: Record<AssertionStateFilter, { label: string; dot: string }> = {
  ALL: { label: 'ALL', dot: 'bg-muted-foreground' },
  ASSERTED: { label: 'ASSERTED', dot: 'bg-blue-400' },
  LLM_DISPUTE: { label: 'LLM DISPUTE', dot: 'bg-red-400' },
  VOTING: { label: 'VOTING', dot: 'bg-purple-400' },
  RESOLVED: { label: 'RESOLVED', dot: 'bg-cyan-400' },
};

const OUTCOME_COLOR: Record<ResolutionOutcome, string> = {
  True: 'text-primary',
  False: 'text-red-400',
  Unresolvable: 'text-zinc-400',
};

export default function AssertionsPage() {
  const params = useParams<{ address: string }>();
  const address = Array.isArray(params?.address) ? params.address[0] : params?.address;
  // Read from the client store so assertions created or mutated this session show up.
  const assertions = filterAssertionsByAddress(address, useAssertions());
  const [filter, setFilter] = useState<AssertionStateFilter>('ALL');
  const [search, setSearch] = useState('');

  const rowsSource = deriveAssertions(assertions);
  const liveCount = rowsSource.filter((a) => a.state === 'ASSERTED').length;
  const inDisputeCount = rowsSource.filter(
    (a) => a.state === 'LLM_DISPUTE' || a.state === 'VOTING'
  ).length;
  const resolvedCount = rowsSource.filter((a) => a.state === 'RESOLVED').length;
  const bondedTotal = rowsSource.reduce((sum, a) => sum + a.bondUSDC, 0);
  const rows = rowsSource.filter((a) => {
    const matchFilter = filter === 'ALL' || a.state === filter;
    const matchSearch = !search || a.statement.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const countByState = (state: AssertionStateFilter): number => {
    if (state === 'ALL') return rowsSource.length;
    return rowsSource.filter((a) => a.state === state).length;
  };

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Rise>
        <div className="border-muted-foreground/20 flex flex-wrap items-center gap-6 border-b py-3 font-mono text-xs tracking-widest uppercase">
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">Assertions</div>
            <div className="text-primary tabular-nums">{rowsSource.length}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">Live</div>
            <div className="text-blue-400 tabular-nums">{liveCount}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">In Dispute</div>
            <div className="text-red-400 tabular-nums">{inDisputeCount}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">Resolved</div>
            <div className="text-cyan-400 tabular-nums">{resolvedCount}</div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="text-muted-foreground">Bonded</div>
            <div className="tabular-nums">{Intl.NumberFormat().format(bondedTotal)} USDC</div>
          </div>
        </div>
      </Rise>

      <Rise delay={0.08}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => {
              const isActive = filter === f.value;
              const count = countByState(f.value);
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
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
            className="bg-muted/10 border-muted-foreground/20 placeholder:text-muted-foreground/40 focus:ring-primary/40 h-10 w-full rounded-none border px-4 font-mono text-sm tracking-widest uppercase focus:ring-1 focus:outline-none sm:w-80"
          />
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
                    State
                  </th>
                  <th className="text-muted-foreground px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    Outcome
                  </th>
                  <th className="text-muted-foreground px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    Disputes
                  </th>
                  <th className="text-muted-foreground px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    Bond
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const { dot } = STATE_META[row.state];
                  const outcomeColor = row.outcome
                    ? OUTCOME_COLOR[row.outcome]
                    : 'text-muted-foreground';
                  return (
                    <m.tr
                      layout
                      key={row.id}
                      className="group border-muted-foreground/10 hover:bg-muted/10 border-b transition-colors last:border-none"
                    >
                      <td colSpan={5} className="p-0">
                        <Link
                          href={`/assertion/browse/${row.id}`}
                          className="grid grid-cols-[45%_1fr_1fr_1fr_1fr] items-center"
                        >
                          <div className="group-hover:text-primary line-clamp-2 px-5 py-4 text-sm transition-colors">
                            {row.statement}
                          </div>

                          <div className="flex items-center gap-2 px-5 py-4">
                            <span className={`size-1.5 rounded-full ${dot}`} />
                            <span className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
                              {STATE_META[row.state].label}
                            </span>
                          </div>

                          <div
                            className={`px-5 py-4 font-mono text-xs tracking-widest uppercase ${outcomeColor}`}
                          >
                            {row.outcome ? getOutcomeLabel(row.outcome) : 'Pending'}
                          </div>

                          <div className="px-5 py-4 font-mono text-xs tabular-nums">
                            {row.disputes > 0 ? (
                              <span className="text-red-400">{row.disputes}</span>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </div>

                          <div className="text-muted-foreground px-5 py-4 font-mono text-xs tracking-widest uppercase tabular-nums">
                            {row.bondUSDC} USDC
                          </div>
                        </Link>
                      </td>
                    </m.tr>
                  );
                })}
              </tbody>
            </table>

            {rows.length === 0 && (
              <div className="flex flex-1 items-center justify-center py-16">
                <span className="text-muted-foreground/50 font-mono text-sm tracking-[0.25em] uppercase">
                  No assertions found
                </span>
              </div>
            )}
          </div>
        </section>
      </Rise>
    </div>
  );
}
