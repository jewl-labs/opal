'use client';
import { motion as m } from 'motion/react';

export default function ResolutionLayers() {
  return (
    <>
      <section className="relative grid gap-8 overflow-x-clip px-4 py-24 md:grid-cols-5">
        <div className="col-span-3 flex flex-col justify-between gap-6">
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-balance uppercase md:text-4xl">
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

        <m.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.2, repeat: Infinity }}
          className="border-primary absolute bottom-4 left-4 z-20 size-4 border-b border-l"
        />
        <m.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.2, repeat: Infinity }}
          className="border-primary absolute top-6 left-4 z-20 size-4 border-t border-l"
        />
        <m.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.2, repeat: Infinity }}
          className="border-primary absolute right-4 bottom-4 z-20 size-4 border-r border-b"
        />
        <m.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.2, repeat: Infinity }}
          className="border-primary absolute top-6 right-4 z-20 size-4 border-t border-r"
        />
      </section>
      <span className="border-muted-foreground/50 top-screen pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
