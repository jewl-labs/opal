'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { filterAssertionsByAddress } from '@/data/assertion';
import { computeAssertionStats } from '@/lib/assertion-stats';

type DisputeStatus = 'ALL' | 'LLM' | 'VOTING' | 'WON' | 'LOST';

interface DisputeView {
  id: string;
  assertionId: string;
  statement: string;
  type: 'LLM' | 'VOTE';
  status: Exclude<DisputeStatus, 'ALL'>;
  opalStaked: string;
  pnl: string;
  date: string;
}

// Derive disputes from assertions
function deriveDisputes(assertions: any[]): DisputeView[] {
  const disputes: DisputeView[] = [];

  assertions.forEach((a) => {
    // LLM disputes
    if (a.llmDispute) {
      const status = a.llmDispute.settled ? (a.llmDispute.disputeCorrect ? 'WON' : 'LOST') : 'LLM';

      disputes.push({
        id: `${a.id}-llm`,
        assertionId: a.id,
        statement: a.statement,
        type: 'LLM',
        status: status as Exclude<DisputeStatus, 'ALL'>,
        opalStaked: a.llmDispute.bondAmountPUSD.toString(),
        pnl: a.llmDispute.disputeCorrect ? `+${a.llmDispute.bondAmountPUSD}` : 'Loss',
        date: new Date(a.llmDispute.createdAt).toLocaleDateString(),
      });
    }

    // Vote disputes
    if (a.voteDispute) {
      const status = a.voteDispute.settled
        ? a.voteDispute.disputeCorrect
          ? 'WON'
          : 'LOST'
        : 'VOTING';

      disputes.push({
        id: `${a.id}-vote`,
        assertionId: a.id,
        statement: a.statement,
        type: 'VOTE',
        status: status as Exclude<DisputeStatus, 'ALL'>,
        opalStaked: a.voteDispute.bondAmountPUSD.toString(),
        pnl: a.voteDispute.disputeCorrect ? `+${a.voteDispute.bondAmountPUSD}` : 'Loss',
        date: new Date(a.voteDispute.createdAt).toLocaleDateString(),
      });
    }
  });

  return disputes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const FILTERS: { label: string; value: DisputeStatus }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'LLM DISPUTE', value: 'LLM' },
  { label: 'VOTING', value: 'VOTING' },
  { label: 'WON', value: 'WON' },
  { label: 'LOST', value: 'LOST' },
];

const STATUS_META: Record<
  Exclude<DisputeStatus, 'ALL'>,
  { label: string; dot: string; text: string }
> = {
  LLM: { label: 'LLM DISPUTE', dot: 'bg-red-400', text: 'text-red-400' },
  VOTING: { label: 'VOTING', dot: 'bg-purple-400', text: 'text-purple-400' },
  WON: { label: 'WON', dot: 'bg-primary', text: 'text-primary' },
  LOST: { label: 'LOST', dot: 'bg-red-500', text: 'text-red-400' },
};

export default function DisputesPage() {
  const params = useParams<{ address: string }>();
  const address = Array.isArray(params?.address) ? params.address[0] : params?.address;
  const assertions = filterAssertionsByAddress(address);
  const [filter, setFilter] = useState<DisputeStatus>('ALL');
  const [search, setSearch] = useState('');

  const disputes = deriveDisputes(assertions as any);
  const stats = computeAssertionStats(assertions as any);
  const rows = disputes.filter((d) => {
    const matchFilter = filter === 'ALL' || d.status === filter;
    const matchSearch = !search || d.statement.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const countByStatus = (status: DisputeStatus): number => {
    if (status === 'ALL') return disputes.length;
    return disputes.filter((d) => d.status === status).length;
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

        <div className="ml-auto flex items-center gap-2">
          <div className="text-muted-foreground">Active</div>
          <div className="text-primary text-[10px] font-semibold">{stats.activeAssertions}</div>
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
                  Type
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Status
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  Bond
                </th>
                <th className="text-muted-foreground px-5 py-3 text-[10px] font-medium tracking-widest uppercase">
                  P&L
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
                    No disputes found
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const { label, dot, text } = STATUS_META[row.status];

                  return (
                    <tr
                      key={row.id}
                      className="group border-muted-foreground/10 hover:bg-muted/10 border-b border-dashed transition-colors last:border-none"
                    >
                      <td colSpan={5} className="p-0">
                        <Link
                          href={`/assertion/browse/${row.assertionId}`}
                          className="grid grid-cols-[45%_1fr_1fr_1fr_1fr] items-center"
                        >
                          {/* statement */}
                          <div className="group-hover:text-primary line-clamp-1 px-5 py-4 text-xs tracking-tight uppercase transition-colors">
                            {row.statement}
                          </div>

                          {/* type */}
                          <div className="px-5 py-4">
                            <span
                              className={`border border-dashed px-2 py-0.5 text-[9px] tracking-widest uppercase ${
                                row.type === 'LLM'
                                  ? 'border-red-400/40 text-red-400'
                                  : 'border-purple-400/40 text-purple-400'
                              }`}
                            >
                              {row.type}
                            </span>
                          </div>

                          {/* status */}
                          <div className="flex items-center gap-2 px-5 py-4">
                            <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
                            <span className={`text-[10px] tracking-wide uppercase ${text}`}>
                              {label}
                            </span>
                          </div>

                          {/* bond */}
                          <div className="text-muted-foreground px-5 py-4 text-[10px] uppercase">
                            {row.opalStaked} PUSD
                          </div>

                          {/* p&l */}
                          <div className="px-5 py-4 text-[10px] font-semibold uppercase">
                            {row.pnl.startsWith('+') ? (
                              <span className="text-primary">{row.pnl}</span>
                            ) : (
                              <span className="text-red-400">{row.pnl}</span>
                            )}
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
