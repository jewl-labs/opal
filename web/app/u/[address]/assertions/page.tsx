'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ASSERTIONS } from '@/data/assertion';
import { computeAssertionStats } from '@/lib/assertion-stats';
import { getTimeRemaining } from '@/lib/helpers';

type AssertionStateFilter = 'ALL' | 'ASSERTED' | 'LLM_DISPUTE' | 'VOTING' | 'RESOLVED';

interface AssertionView {
  id: string;
  statement: string;
  state: AssertionStateFilter;
  outcome: string;
  disputes: number;
  bondPUSD: number;
  createdAt: string;
  expiresIn?: string;
}

// Derive assertions from data
function deriveAssertions(): AssertionView[] {
  return ASSERTIONS.map((a) => {
    const raw = (a.state || '').toLowerCase();
    let stateKey: AssertionStateFilter = 'ASSERTED';

    if (raw.includes('llm')) stateKey = 'LLM_DISPUTE';
    else if (raw.includes('vot')) stateKey = 'VOTING';
    else if (raw.includes('resolv')) stateKey = 'RESOLVED';
    else stateKey = 'ASSERTED';

    return {
      id: a.id,
      statement: a.statement,
      state: stateKey,
      outcome: a.outcome || 'PENDING',
      disputes: a.disputeCount,
      bondPUSD: a.bondAmountPUSD,
      createdAt: new Date(a.createdAt).toLocaleDateString(),
      expiresIn: getTimeRemaining(a.livenessDeadline),
    };
  });
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

const OUTCOME_COLOR: Record<string, string> = {
  TRUE: 'text-primary',
  FALSE: 'text-red-400',
  'TOO EARLY': 'text-cyan-400',
  UNRESOLVABLE: 'text-zinc-400',
  PENDING: 'text-muted-foreground',
};

export default function AssertionsPage() {
  const [filter, setFilter] = useState<AssertionStateFilter>('ALL');
  const [search, setSearch] = useState('');

  const assertions = deriveAssertions();
  const stats = computeAssertionStats(ASSERTIONS as any);
  const rows = assertions.filter((a) => {
    const matchFilter = filter === 'ALL' || a.state === filter;
    const matchSearch = !search || a.statement.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const countByState = (state: AssertionStateFilter): number => {
    if (state === 'ALL') return assertions.length;
    return assertions.filter((a) => a.state === state).length;
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* consistent slim status bar */}
      <div className="border-muted-foreground/20 flex items-center gap-6 border-b border-dashed py-3 text-[10px] tracking-widest uppercase">
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
            const count = countByState(f.value);
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
                  State
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Outcome
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Disputes
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Bond
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
                    No assertions found
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const { dot } = STATE_META[row.state];
                  const outcomeColor = OUTCOME_COLOR[row.outcome] || 'text-muted-foreground';
                  return (
                    <tr
                      key={row.id}
                      className="group border-muted-foreground/10 hover:bg-muted/10 border-b border-dashed transition-colors last:border-none"
                    >
                      <td colSpan={5} className="p-0">
                        <Link
                          href={`/assertion/browse/${row.id}`}
                          className="grid grid-cols-[45%_1fr_1fr_1fr_1fr] items-center"
                        >
                          {/* statement */}
                          <div className="group-hover:text-primary line-clamp-2 px-5 py-4 text-xs tracking-tight uppercase transition-colors">
                            {row.statement}
                          </div>

                          {/* state */}
                          <div className="flex items-center gap-2 px-5 py-4">
                            <span className={`size-1.5 rounded-full ${dot}`} />
                            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                              {STATE_META[row.state].label}
                            </span>
                          </div>

                          {/* outcome */}
                          <div
                            className={`px-5 py-4 text-[10px] font-semibold tracking-wide uppercase ${outcomeColor}`}
                          >
                            {row.outcome}
                          </div>

                          {/* disputes */}
                          <div className="px-5 py-4 text-[10px] uppercase">
                            {row.disputes > 0 ? (
                              <span className="text-red-400">{row.disputes}</span>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </div>

                          {/* bond */}
                          <div className="text-muted-foreground px-5 py-4 text-[10px] uppercase">
                            {row.bondPUSD} PUSD
                          </div>
                        </Link>
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
