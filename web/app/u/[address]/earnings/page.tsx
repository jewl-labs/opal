'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { motion as m } from 'motion/react';

import Rise from '@/components/common/rise';
import { filterAssertionsByAddress, votesByAddress } from '@/data/assertion';
import type { UserVoteEntry } from '@/data/assertion';
import { useAssertions } from '@/lib/assertion-store';
import type { AssertionAccount } from '@/types';

type EarningType = 'ALL' | 'DISPUTE_WIN' | 'BOND_RETURN' | 'VOTE_REWARD';

interface Earning {
  id: string;
  assertionId: string;
  statement: string;
  type: Exclude<EarningType, 'ALL'>;
  amount: number;
  date: string;
  timestamp: number;
}

// Aligned voters earn a proportional reward on their stake (mock: 10%).
function voteReward(weight: number) {
  return Math.floor(weight / 10);
}

// Earnings for the viewed address only. filterAssertionsByAddress returns assertions where
// the wallet is the asserter OR a disputer, so each row re-checks the role: a winning
// disputer's counter-bond, an asserter's returned bond. Vote rewards come from the wallet's
// own per-voter records (aligned settled votes).
function deriveEarnings(
  assertions: AssertionAccount[],
  voteEntries: UserVoteEntry[],
  address: string | undefined
): Earning[] {
  const earnings: Earning[] = [];

  for (const assertion of assertions) {
    if (
      assertion.llmDispute &&
      assertion.llmDispute.disputer === address &&
      assertion.llmDispute.settled &&
      assertion.llmDispute.disputeCorrect
    ) {
      earnings.push({
        id: `${assertion.id}-llm-win`,
        assertionId: assertion.id,
        statement: assertion.statement,
        type: 'DISPUTE_WIN',
        amount: assertion.llmDispute.bondAmountPUSD,
        date: new Date(assertion.llmDispute.createdAt).toLocaleDateString(),
        timestamp: new Date(assertion.llmDispute.createdAt).getTime(),
      });
    }

    if (
      assertion.voteDispute &&
      assertion.voteDispute.disputer === address &&
      assertion.voteDispute.settled &&
      assertion.voteDispute.disputeCorrect
    ) {
      earnings.push({
        id: `${assertion.id}-vote-win`,
        assertionId: assertion.id,
        statement: assertion.statement,
        type: 'DISPUTE_WIN',
        amount: assertion.voteDispute.bondAmountPUSD,
        date: new Date(assertion.voteDispute.createdAt).toLocaleDateString(),
        timestamp: new Date(assertion.voteDispute.createdAt).getTime(),
      });
    }

    // The asserter's bond is returned once their own assertion resolves — unless it
    // resolved False, in which case the bond was slashed and paid to the winning
    // disputer (Unresolvable settles no-fault, so the bond still comes back).
    if (
      assertion.asserter === address &&
      assertion.state === 'Resolved' &&
      assertion.outcome !== 'False'
    ) {
      const returnedAt = assertion.finalizedAt || assertion.createdAt;
      earnings.push({
        id: `${assertion.id}-bond-return`,
        assertionId: assertion.id,
        statement: assertion.statement,
        type: 'BOND_RETURN',
        amount: assertion.bondAmountPUSD,
        date: new Date(returnedAt).toLocaleDateString(),
        timestamp: new Date(returnedAt).getTime(),
      });
    }
  }

  // Vote rewards: only aligned votes on settled rounds pay out.
  for (const entry of voteEntries) {
    if (entry.assertion.state !== 'Resolved') continue;
    if (entry.outcome !== entry.assertion.outcome) continue;
    const at = entry.assertion.finalizedAt || entry.assertion.createdAt;
    earnings.push({
      id: `${entry.assertion.id}-vote-reward`,
      assertionId: entry.assertion.id,
      statement: entry.assertion.statement,
      type: 'VOTE_REWARD',
      amount: voteReward(entry.weight),
      date: new Date(at).toLocaleDateString(),
      timestamp: new Date(at).getTime(),
    });
  }

  return earnings.sort((a, b) => b.timestamp - a.timestamp);
}

const FILTERS: { label: string; value: EarningType }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'DISPUTE WIN', value: 'DISPUTE_WIN' },
  { label: 'BOND RETURN', value: 'BOND_RETURN' },
  { label: 'VOTE REWARD', value: 'VOTE_REWARD' },
];

const TYPE_META: Record<
  Exclude<EarningType, 'ALL'>,
  { label: string; border: string; text: string }
> = {
  DISPUTE_WIN: { label: 'DISPUTE WIN', border: 'border-primary/40', text: 'text-primary' },
  BOND_RETURN: { label: 'BOND RETURN', border: 'border-cyan-400/40', text: 'text-cyan-400' },
  VOTE_REWARD: { label: 'VOTE REWARD', border: 'border-purple-400/40', text: 'text-purple-400' },
};

export default function EarningsPage() {
  const params = useParams<{ address: string }>();
  const address = Array.isArray(params?.address) ? params.address[0] : params?.address;
  const allAssertions = useAssertions();
  const assertions = filterAssertionsByAddress(address, allAssertions);
  const voteEntries = votesByAddress(address, allAssertions);
  const [filter, setFilter] = useState<EarningType>('ALL');
  const [search, setSearch] = useState('');

  const earnings = deriveEarnings(assertions, voteEntries, address);

  const rows = earnings.filter((e) => {
    const matchFilter = filter === 'ALL' || e.type === filter;
    const matchSearch = !search || e.statement.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const sumByType = (type: Exclude<EarningType, 'ALL'>) =>
    earnings.filter((e) => e.type === type).reduce((sum, e) => sum + e.amount, 0);
  const totalEarned = earnings.reduce((sum, e) => sum + e.amount, 0);
  const fmt = (n: number) => Intl.NumberFormat().format(n);

  const breakdown = [
    { label: 'Dispute Wins', type: 'DISPUTE_WIN' as const, text: 'text-primary' },
    { label: 'Bond Returns', type: 'BOND_RETURN' as const, text: 'text-cyan-400' },
    { label: 'Vote Rewards', type: 'VOTE_REWARD' as const, text: 'text-purple-400' },
  ];

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Rise>
        <div className="border-muted-foreground/20 flex flex-col gap-6 border-b py-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
              Total Earned
            </span>
            <span className="text-primary font-mono text-4xl tabular-nums">
              +{fmt(totalEarned)}
              <span className="text-primary/50 ml-2 text-base uppercase">USDC</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {breakdown.map((b) => (
              <div key={b.type} className="flex flex-col gap-1">
                <span className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
                  {b.label}
                </span>
                <span className={`font-mono text-lg tabular-nums ${b.text}`}>
                  +{fmt(sumByType(b.type))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Rise>

      <Rise delay={0.08}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => {
              const isActive = filter === f.value;
              const count =
                f.value === 'ALL'
                  ? earnings.length
                  : earnings.filter((e) => e.type === f.value).length;
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
                  <th className="text-muted-foreground w-[50%] px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    Assertion
                  </th>
                  <th className="text-muted-foreground px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    Type
                  </th>
                  <th className="text-muted-foreground px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    Amount
                  </th>
                  <th className="text-muted-foreground px-5 py-3 font-mono text-xs font-normal tracking-widest uppercase">
                    Date
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const { label, border, text } = TYPE_META[row.type];
                  return (
                    <m.tr
                      layout
                      key={row.id}
                      className="group border-muted-foreground/10 hover:bg-muted/10 border-b transition-colors last:border-none"
                    >
                      <td colSpan={4} className="p-0">
                        <Link
                          href={`/assertion/browse/${row.assertionId}`}
                          className="grid grid-cols-[50%_1fr_1fr_1fr] items-center"
                        >
                          <div className="group-hover:text-primary line-clamp-1 px-5 py-4 text-sm transition-colors">
                            {row.statement}
                          </div>

                          <div className="px-5 py-4">
                            <span
                              className={`border px-2 py-0.5 font-mono text-xs tracking-widest uppercase ${border} ${text}`}
                            >
                              {label}
                            </span>
                          </div>

                          <div className="text-primary px-5 py-4 font-mono text-xs tracking-widest uppercase tabular-nums">
                            +{fmt(row.amount)} USDC
                          </div>

                          <div className="text-muted-foreground px-5 py-4 font-mono text-xs tabular-nums">
                            {row.date}
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
                  No earnings found
                </span>
              </div>
            )}
          </div>
        </section>
      </Rise>
    </div>
  );
}
