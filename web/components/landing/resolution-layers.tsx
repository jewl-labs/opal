import CornerMarker from "../common/corner-marker";

export default function ResolutionLayers() {
  return (
    <>
      <section className="relative grid gap-8 overflow-x-clip px-4 py-32 md:grid-cols-5">
        <div className="col-span-3 flex flex-col justify-between gap-6">
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-center text-balance uppercase md:text-4xl">
            State determines the current answer
          </h2>
        </div>

        <div className="col-span-2 grid gap-4">
          {[
            {
              title: 'Asserted',
              summary: 'Default answer is true. The statement can still be challenged.',
            },
            {
              title: 'AssertedLLM',
              summary: 'The first dispute resolved. Consumers read LlmResolutionRound.outcome.',
            },
            {
              title: 'PendingVote / Voting',
              summary: 'The LLM result is under challenge and the final answer is not settled yet.',
            },
            {
              title: 'Resolved',
              summary:
                'Outcome is final, settlement is irreversible, and integrations can safely settle.',
            },
          ].map((item) => (
            <article
              key={item.title}
              className="border-border/80 bg-background/70 border p-5 shadow-sm backdrop-blur"
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold tracking-wider uppercase">{item.title}</h3>
                <span className="text-primary text-xs tracking-wider uppercase">State</span>
              </div>
              <p className="text-muted-foreground mt-4 text-sm">{item.summary}</p>
            </article>
          ))}
        </div>
        <CornerMarker position="bottom"/>
      </section>
      <span className="border-muted-foreground/50 top-screen pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
