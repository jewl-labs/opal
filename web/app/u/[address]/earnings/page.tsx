'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { filterAssertionsByAddress } from '@/data/assertion';
import { computeAssertionStats } from '@/lib/assertion-stats';

type EarningType = 'ALL' | 'DISPUTE_WIN' | 'VOTE_REWARD' | 'BOND_RETURN';

interface Earning {
  id: string;
  assertionId: string;
  statement: string;
  type: Exclude<EarningType, 'ALL'>;
  amount: string;
  date: string;
}

// Derive earnings from assertions
function deriveEarnings(assertions: any[]): Earning[] {
  const earnings: Earning[] = [];

  assertions.forEach((assertion) => {
    // Dispute wins
    if (assertion.llmDispute?.settled && assertion.llmDispute?.disputeCorrect) {
      earnings.push({
        id: `${assertion.id}-llm-win`,
        assertionId: assertion.id,
        statement: assertion.statement,
        type: 'DISPUTE_WIN',
        amount: `+${assertion.llmDispute.bondAmountPUSD} PUSD`,
        date: new Date(assertion.llmDispute.createdAt).toLocaleDateString(),
      });
    }

    if (assertion.voteDispute?.settled && assertion.voteDispute?.disputeCorrect) {
      earnings.push({
        id: `${assertion.id}-vote-win`,
        assertionId: assertion.id,
        statement: assertion.statement,
        type: 'DISPUTE_WIN',
        amount: `+${assertion.voteDispute.bondAmountPUSD} PUSD`,
        date: new Date(assertion.voteDispute.createdAt).toLocaleDateString(),
      });
    }

    // Vote rewards - use vote weight as proxy
    if (assertion.voteResolutionRound) {
      earnings.push({
        id: `${assertion.id}-vote-reward`,
        assertionId: assertion.id,
        statement: assertion.statement,
        type: 'VOTE_REWARD',
        amount: `+${Math.floor(Number(assertion.voteResolutionRound.totalValidWeight / 100n))} OPAL`,
        date: new Date(assertion.createdAt).toLocaleDateString(),
      });
    }

    // Bond returns for resolved assertions
    if (assertion.state === 'Resolved') {
      earnings.push({
        id: `${assertion.id}-bond-return`,
        assertionId: assertion.id,
        statement: assertion.statement,
        type: 'BOND_RETURN',
        amount: `+${assertion.bondAmountPUSD} PUSD`,
        date: new Date(assertion.finalizedAt || assertion.createdAt).toLocaleDateString(),
      });
    }
  });

  return earnings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const FILTERS: { label: string; value: EarningType }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'DISPUTE WIN', value: 'DISPUTE_WIN' },
  { label: 'VOTE REWARD', value: 'VOTE_REWARD' },
  { label: 'BOND RETURN', value: 'BOND_RETURN' },
];

const TYPE_META: Record<
  Exclude<EarningType, 'ALL'>,
  { label: string; border: string; text: string }
> = {
  DISPUTE_WIN: { label: 'DISPUTE WIN', border: 'border-primary/40', text: 'text-primary' },
  VOTE_REWARD: { label: 'VOTE REWARD', border: 'border-purple-400/40', text: 'text-purple-400' },
  BOND_RETURN: { label: 'BOND RETURN', border: 'border-cyan-400/40', text: 'text-cyan-400' },
};

export default function EarningsPage() {
  const params = useParams<{ address: string }>();
  const address = Array.isArray(params?.address) ? params.address[0] : params?.address;
  const assertions = filterAssertionsByAddress(address);
  const [filter, setFilter] = useState<EarningType>('ALL');
  const [search, setSearch] = useState('');

  const earnings = deriveEarnings(assertions as any);

  const stats = computeAssertionStats(assertions as any);

  const rows = earnings.filter((e) => {
    const matchFilter = filter === 'ALL' || e.type === filter;
    const matchSearch = !search || e.statement.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalAmount = earnings.reduce((acc, e) => {
    const amount = parseFloat(e.amount.replace('+', '').replace(' PUSD', '').replace(' OPAL', ''));
    return acc + (isNaN(amount) ? 0 : amount);
  }, 0);

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
            const count =
              f.value === 'ALL'
                ? earnings.length
                : earnings.filter((e) => e.type === f.value).length;
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
                <th className="text-muted-foreground w-[50%] px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Assertion
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Type
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Amount
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-muted-foreground/30 py-16 text-center text-xs uppercase"
                  >
                    No earnings found
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const { label, border, text } = TYPE_META[row.type];
                  return (
                    <tr
                      key={row.id}
                      className="group border-muted-foreground/10 hover:bg-muted/10 border-b border-dashed transition-colors last:border-none"
                    >
                      <td colSpan={4} className="p-0">
                        <Link
                          href={`/assertion/browse/${row.assertionId}`}
                          className="grid grid-cols-[50%_1fr_1fr_1fr] items-center"
                        >
                          {/* statement */}
                          <div className="group-hover:text-primary line-clamp-1 px-5 py-4 text-xs tracking-tight uppercase transition-colors">
                            {row.statement}
                          </div>

                          {/* type badge */}
                          <div className="px-5 py-4">
                            <span
                              className={`border border-dashed px-2 py-0.5 text-[9px] tracking-widest uppercase ${border} ${text}`}
                            >
                              {label}
                            </span>
                          </div>

                          {/* amount */}
                          <div className="text-primary px-5 py-4 text-[10px] font-semibold uppercase">
                            {row.amount}
                          </div>

                          {/* date */}
                          <div className="text-muted-foreground px-5 py-4 text-[10px] uppercase">
                            {row.date}
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
