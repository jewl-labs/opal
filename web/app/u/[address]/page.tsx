'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { filterAssertionsByAddress } from '@/data/assertion';
import { computeAssertionStats, topControversialAssertion } from '@/lib/assertion-stats';
import { getTimeRemaining } from '@/lib/helpers';

export default function Activity() {
  const params = useParams<{ address: string }>();
  const address = Array.isArray(params?.address) ? params.address[0] : params?.address;
  const assertions = filterAssertionsByAddress(address);
  const stats = computeAssertionStats(assertions as any);
  const top = topControversialAssertion(assertions as any);

  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <Hero top={top as any} stats={stats as any} />
      <Stats stats={stats as any} assertions={assertions as any} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ProtocolActivity assertions={assertions as any} />
        <ResolutionBreakdown assertions={assertions as any} />
        <ReputationPanel assertions={assertions as any} />
      </div>

      <RecentAssertions assertions={assertions as any} />
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

function ProtocolActivity({ assertions }: { assertions: any[] }) {
  const activity = assertions
    .flatMap((assertion) => {
      const items = [] as {
        title: string;
        description: string;
        time: string;
        color: string;
        timestamp: number;
      }[];

      if (assertion.createdAt) {
        const ts = new Date(assertion.createdAt).getTime();
        items.push({
          title: 'ASSERTION CREATED',
          description: assertion.statement,
          time: new Date(ts).toLocaleDateString().toUpperCase(),
          color: 'bg-orange-400',
          timestamp: ts,
        });
      }

      if (assertion.llmDispute?.createdAt) {
        const ts = new Date(assertion.llmDispute.createdAt).getTime();
        items.push({
          title: 'LLM DISPUTE OPENED',
          description: assertion.statement,
          time: new Date(ts).toLocaleDateString().toUpperCase(),
          color: 'bg-red-400',
          timestamp: ts,
        });
      }

      if (assertion.voteResolutionRound?.votingStartsAt) {
        const ts = new Date(assertion.voteResolutionRound.votingStartsAt).getTime();
        items.push({
          title: 'VOTING STARTED',
          description: assertion.statement,
          time: new Date(ts).toLocaleDateString().toUpperCase(),
          color: 'bg-purple-400',
          timestamp: ts,
        });
      }

      if (assertion.finalizedAt) {
        const ts = new Date(assertion.finalizedAt).getTime();
        items.push({
          title: 'ASSERTION FINALIZED',
          description: assertion.statement,
          time: new Date(ts).toLocaleDateString().toUpperCase(),
          color: 'bg-green-400',
          timestamp: ts,
        });
      }

      return items;
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 4);

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

function ResolutionBreakdown({ assertions }: { assertions: any[] }) {
  const counters = assertions.reduce(
    (acc, assertion) => {
      const raw = assertion.voteResolutionRound?.finalOutcome || assertion.outcome || 'PENDING';
      const normalized = raw
        .replace('TooEarly', 'TOO EARLY')
        .replace('Unresolvable', 'UNRESOLVABLE')
        .toUpperCase();

      if (normalized === 'TRUE') acc.true += 1;
      if (normalized === 'FALSE') acc.false += 1;
      if (normalized === 'TOO EARLY') acc.tooEarly += 1;
      if (normalized === 'UNRESOLVABLE') acc.unresolvable += 1;

      return acc;
    },
    { true: 0, false: 0, tooEarly: 0, unresolvable: 0 }
  );

  const total = counters.true + counters.false + counters.tooEarly + counters.unresolvable || 1;
  const pct = (value: number) => `${Math.round((value / total) * 100)}%`;

  const data = [
    {
      label: 'TRUE',
      value: counters.true,
      width: pct(counters.true),
      color: 'bg-primary',
    },
    {
      label: 'FALSE',
      value: counters.false,
      width: pct(counters.false),
      color: 'bg-red-400',
    },
    {
      label: 'TOO EARLY',
      value: counters.tooEarly,
      width: pct(counters.tooEarly),
      color: 'bg-cyan-400',
    },
    {
      label: 'UNRESOLVABLE',
      value: counters.unresolvable,
      width: pct(counters.unresolvable),
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

function ReputationPanel({ assertions }: { assertions: any[] }) {
  const { correct, incorrect } = assertions.reduce(
    (acc, assertion) => {
      if (assertion.llmDispute?.settled) {
        assertion.llmDispute.disputeCorrect ? (acc.correct += 1) : (acc.incorrect += 1);
      }
      if (assertion.voteDispute?.settled) {
        assertion.voteDispute.disputeCorrect ? (acc.correct += 1) : (acc.incorrect += 1);
      }
      return acc;
    },
    { correct: 0, incorrect: 0 }
  );

  const totalSettled = correct + incorrect;
  const reputationScore = totalSettled > 0 ? Math.round((correct / totalSettled) * 100) : 0;
  const alignment = totalSettled > 0 ? `${Math.round((correct / totalSettled) * 100)}%` : '—';
  const assertionsOverturned = assertions.filter(
    (assertion) =>
      assertion.voteResolutionRound?.finalOutcome &&
      assertion.outcome &&
      assertion.voteResolutionRound.finalOutcome !== assertion.outcome
  ).length;

  return (
    <Panel title="Oracle Reputation">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col justify-between">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[10px] uppercase">Reputation Score</span>

            <span className="text-primary text-6xl font-semibold tracking-tighter">
              {reputationScore}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-primary text-[8px] uppercase">ACCURACY</span>

            <span className="text-muted-foreground text-[10px] uppercase">
              {alignment === '—' ? 'NO HISTORY' : 'TOP 20%'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <MiniMeta label="Correct Disputes" value={String(correct)} />

          <MiniMeta label="Incorrect Disputes" value={String(incorrect)} />

          <MiniMeta label="Vote Alignment" value={alignment} />

          <MiniMeta label="Assertions Overturned" value={String(assertionsOverturned)} />
        </div>
      </div>
    </Panel>
  );
}

function RecentAssertions({ assertions }: { assertions: any[] }) {
  const rows = assertions.slice(0, 6).map((a) => ({
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
