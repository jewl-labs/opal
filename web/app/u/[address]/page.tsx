'use client';

import Link from 'next/link';

import { ASSERTIONS } from '@/data/assertion';
import { computeAssertionStats, topControversialAssertion } from '@/lib/assertion-stats';
import { getTimeRemaining } from '@/lib/helpers';

export default function Activity() {
  const stats = computeAssertionStats(ASSERTIONS as any);
  const top = topControversialAssertion(ASSERTIONS as any);

  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <Hero top={top as any} stats={stats as any} />
      <Stats stats={stats as any} assertions={ASSERTIONS as any} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ProtocolActivity />
        <ResolutionBreakdown />
        <ReputationPanel />
      </div>

      <RecentAssertions />
    </div>
  );
}

function Hero({ top, stats }: { top: any; stats: any }) {
  const disputes = top?.disputeCount || 0;
  const opalLocked = stats?.totalValidWeight || 0;
  const votingActive =
    top?.voteResolutionRound?.votingDeadline &&
    new Date(top.voteResolutionRound.votingDeadline) > new Date();

  return (
    <section className="border-muted-foreground/30 bg-muted/5 flex flex-col items-center justify-between gap-6 border-b border-dashed pb-4 lg:flex-row">
      <div className="flex w-full flex-col gap-3">
        <span className="text-muted-foreground text-center text-xs tracking-[0.3em] uppercase">
          Most Controversial Assertion
        </span>

        <h2 className="max-w-3xl text-center text-2xl font-semibold tracking-tight uppercase md:text-4xl">
          {top?.statement || '—'}
        </h2>

        <div className="flex items-center justify-center gap-6 text-xs uppercase">
          <span className="text-primary">{disputes} Disputes</span>
          <span className="text-primary">{Intl.NumberFormat().format(opalLocked)} OPAL Locked</span>
          <span className="text-primary">{votingActive ? 'Voting Active' : '—'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:min-w-[320px]">
        <HeroMeta
          label="Current Consensus"
          value={top?.voteResolutionRound?.finalOutcome || top?.outcome || '—'}
        />

        <HeroMeta
          label="Vote Deadline"
          value={getTimeRemaining(top?.voteResolutionRound?.votingDeadline)}
        />

        <HeroMeta label="Bond Pool" value={`${top?.bondAmountPUSD || 0} PUSD`} />

        <HeroMeta label="Escalation" value={top?.state || '—'} />
      </div>
    </section>
  );
}

function Stats({ stats, assertions }: { stats: any; assertions: any[] }) {
  const disputesWon = assertions.reduce((acc, a) => {
    const llm = a.llmDispute?.settled && a.llmDispute?.disputeCorrect ? 1 : 0;
    const vote = a.voteDispute?.settled && a.voteDispute?.disputeCorrect ? 1 : 0;
    return acc + llm + vote;
  }, 0);

  const accuracy =
    assertions.length > 0
      ? `${Math.round((disputesWon / Math.max(1, stats.totalDisputes)) * 100)}%`
      : '—';

  const data = [
    { label: 'Assertions Created', value: String(stats.totalAssertions) },
    { label: 'Total Bonded PUSD', value: String(stats.totalBondPUSD) },
    { label: 'OPAL Locked', value: Intl.NumberFormat().format(stats.totalValidWeight || 0) },
    { label: 'Disputes Won', value: String(disputesWon) },
    { label: 'Dispute Accuracy', value: accuracy },
    { label: 'Active Assertions', value: String(stats.activeAssertions) },
  ];

  return (
    <div className="xl:grid-cols- grid grid-cols-2 gap-4">
      {data.map((item) => (
        <StatsCard key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

function ProtocolActivity() {
  const activity = [
    {
      title: 'ASSERTION CREATED',
      description: 'kanye west delhi concert postponed',
      time: '2H AGO',
      color: 'bg-orange-400',
    },
    {
      title: 'LLM DISPUTE OPENED',
      description: 'fusion energy powers a city grid',
      time: '5H AGO',
      color: 'bg-red-400',
    },
    {
      title: 'VOTING STARTED',
      description: 'mars colony established by 2030',
      time: '9H AGO',
      color: 'bg-purple-400',
    },
    {
      title: 'ASSERTION FINALIZED',
      description: 'openai releases gpt-6 before 2027',
      time: '1D AGO',
      color: 'bg-green-400',
    },
  ];

  return (
    <Panel title="Protocol Activity">
      <div className="flex flex-col">
        {activity.map((item, index) => (
          <div key={index} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={`ring-secondary z-10 aspect-square size-2 rounded-full ring-2 ${item.color}`}
              />

              {index !== activity.length - 1 && (
                <div className="bg-muted-foreground/30 h-full w-px border-r border-dashed" />
              )}
            </div>

            <div className="flex flex-1 -translate-y-1.5 flex-col gap-1 border-b border-dashed pb-6 last:border-none">
              <div className="flex items-center justify-between">
                <span className="text-sm uppercase">{item.title}</span>

                <span className="text-muted-foreground text-[10px] uppercase">{item.time}</span>
              </div>

              <span className="text-muted-foreground text-xs uppercase">{item.description}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ResolutionBreakdown() {
  const data = [
    {
      label: 'TRUE',
      value: 18,
      width: '72%',
      color: 'bg-primary',
    },
    {
      label: 'FALSE',
      value: 9,
      width: '40%',
      color: 'bg-red-400',
    },
    {
      label: 'TOO EARLY',
      value: 3,
      width: '18%',
      color: 'bg-cyan-400',
    },
    {
      label: 'UNRESOLVABLE',
      value: 2,
      width: '12%',
      color: 'bg-zinc-400',
    },
  ];

  return (
    <Panel title="Resolution Breakdown">
      <div className="flex flex-col gap-6">
        {data.map((item) => (
          <div key={item.label} className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs uppercase">
              <span>{item.label}</span>

              <span>{item.value}</span>
            </div>

            <div className="bg-muted-foreground/10 h-3 overflow-hidden">
              <div
                className={`h-full ${item.color}`}
                style={{
                  width: item.width,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ReputationPanel() {
  return (
    <Panel title="Oracle Reputation">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col justify-between">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[10px] uppercase">Reputation Score</span>

            <span className="text-primary text-6xl font-semibold tracking-tighter">78</span>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-primary text-[8px] uppercase">HIGH ACCURACY</span>

            <span className="text-muted-foreground text-[10px] uppercase">TOP 12%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <MiniMeta label="Correct Disputes" value="23" />

          <MiniMeta label="Incorrect Disputes" value="4" />

          <MiniMeta label="Vote Alignment" value="81%" />

          <MiniMeta label="Assertions Overturned" value="7" />
        </div>
      </div>
    </Panel>
  );
}

function RecentAssertions() {
  const rows = ASSERTIONS.slice(0, 6).map((a) => ({
    id: a.id,
    statement: a.statement,
    stage: a.state,
    outcome: a.outcome || 'PENDING',
    disputes: a.disputeCount || 0,
    bond: `${a.bondAmountPUSD} PUSD`,
    outcomeClass:
      a.outcome === 'True'
        ? 'text-primary'
        : a.outcome === 'False'
          ? 'text-red-300'
          : 'text-zinc-400',
  }));

  return (
    <Panel title="Recent Assertions" className="text-left">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-muted-foreground/20 border-b border-dashed text-left">
              <th className="w-[45%] py-3 text-xs font-medium uppercase">Assertion</th>
              <th className="py-3 text-xs font-medium uppercase">Stage</th>
              <th className="py-3 text-xs font-medium uppercase">Outcome</th>
              <th className="py-3 text-xs font-medium uppercase">Disputes</th>
              <th className="py-3 text-xs font-medium uppercase">Bond Pool</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="group border-muted-foreground/10 hover:bg-muted/5 border-b border-dashed transition-all duration-200"
              >
                <td colSpan={5} className="p-0">
                  <Link
                    href={`/assertion/browse/${row.id}`}
                    className="grid grid-cols-[45%_1fr_1fr_1fr_1fr] items-center"
                  >
                    <div className="group-hover:text-primary py-5 text-sm uppercase transition-colors">
                      {row.statement}
                    </div>
                    <div className="py-5 text-xs uppercase">{row.stage}</div>

                    <div className={`py-5 text-xs uppercase ${row.outcomeClass}`}>
                      {row.outcome}
                    </div>

                    <div className="py-5 text-xs uppercase">{row.disputes}</div>

                    <div className="py-5 text-xs uppercase">{row.bond}</div>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function StatsCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={`border-muted-foreground/40 bg-muted/5 flex h-28 flex-col items-center justify-center gap-2 border border-dashed`}
    >
      <span className={`text-2xl font-medium tracking-tighter`}>{value}</span>

      <span className="text-muted-foreground/70 text-center text-[10px] uppercase">{label}</span>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border-muted-foreground/30 bg-muted/5 flex flex-col gap-6 border border-dashed p-5 text-center ${className}`}
    >
      <h2 className="text-muted-foreground text-xs tracking-[0.25em] uppercase">{title}</h2>

      {children}
    </section>
  );
}

function HeroMeta({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="border-muted-foreground/20 flex flex-col gap-1 border border-dashed p-3 text-center">
      <span className="text-muted-foreground text-[10px] uppercase">{label}</span>

      <span className={`text-primary text-sm font-semibold uppercase ${valueClass}`}>{value}</span>
    </div>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[10px] uppercase">{label}</span>

      <span className="text-sm font-semibold uppercase">{value}</span>
    </div>
  );
}
