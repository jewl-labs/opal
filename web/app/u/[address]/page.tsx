export default function Activity() {
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <Stats />
    </div>
  );
}

function Stats() {
  const data = {
    assertion_created: 32,
    total_bonded_pusd: 300,
    opal_locked: 400,
    dispute_won: 23,
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard label="Assertions Created" value={data.assertion_created} />
      <StatsCard label="Total Bonded PUSD" value={data.total_bonded_pusd} />
      <StatsCard label="Opal Locked" value={data.opal_locked} />
      <StatsCard label="Dispute Won" value={data.dispute_won} />
    </div>
  );
}

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/10 border-muted-foreground/50 flex h-28 flex-col items-center justify-center gap-2 border border-dashed">
      <span className="text-2xl font-medium tracking-tighter md:text-3xl">{value}</span>
      <span className="text-muted-foreground/70 text-xs uppercase md:text-sm">{label}</span>
    </div>
  );
}
