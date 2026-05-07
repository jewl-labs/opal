import CornerMarker from '../common/corner-marker';

export default function Consumer() {
  return (
    <>
      <section className="relative overflow-x-clip px-4 py-32">
        <div className="mx-auto mb-16 max-w-3xl">
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-balance uppercase md:text-4xl">
            Built for integrators, challengers, and protocol operators
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: 'Prediction markets',
              text: 'Settle subjective markets only when the assertion reaches Resolved. Consumers can read the state machine and wait for the terminal outcome.',
            },
            {
              title: 'Disputers',
              text: 'Challenge optimistic defaults or challenged LLM outputs for direct economic upside. The protocol is designed to reward accurate disputes.',
            },
            {
              title: 'Builders',
              text: 'One assertion PDA can expose the current state, round pointers, dispute count, and final answer for downstream applications.',
            },
            {
              title: 'Future operators',
              text: 'Switchboard, Nosana, and MagicBlock integrations are reserved in the accounts, but v1 does not require those systems to be live.',
            },
          ].map((item) => (
            <article
              key={item.title}
              className="border-border/80 bg-background/70 border p-6 shadow-sm backdrop-blur"
            >
              <header className="border-muted-foreground/40 flex items-start justify-between gap-4 border-b border-dashed pb-4">
                <h3 className="text-lg font-semibold tracking-tight uppercase">{item.title}</h3>
                <span className="text-primary text-xs font-semibold tracking-[0.35em] uppercase">
                  Opal
                </span>
              </header>
              <p className="text-muted-foreground mt-5 text-sm leading-7">{item.text}</p>
            </article>
          ))}
        </div>
        <CornerMarker position="bottom" />
      </section>
      <span className="border-muted-foreground/50 pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
