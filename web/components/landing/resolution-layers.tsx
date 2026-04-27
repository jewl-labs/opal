'use client';
import { motion as m } from 'motion/react';

export default function ResolutionLayers() {
  return (
    <>
      <section className="relative overflow-hidden px-4 py-24">
        <h2 className="text-center text-3xl font-bold tracking-tight uppercase md:text-4xl">
          State defines the answer
        </h2>

        <div className="relative mt-12 gap-10">
          <div className="grid gap-6">
            {[
              {
                title: 'Asserted',
                summary: 'Default answer is true while the statement remains challengeable.',
                tag: 'Layer 01',
              },
              {
                title: 'AssertedLLM',
                summary: 'First dispute resolved. Consumers read LlmResolutionRound.outcome.',
                tag: 'Layer 02',
              },
              {
                title: 'PendingVote / Voting',
                summary: 'The LLM result is challenged and the final answer remains open.',
                tag: 'Layer 03',
              },
              {
                title: 'Resolved',
                summary:
                  'Outcome is final, settlement is irreversible, and integrations can safely settle.',
                tag: 'Layer 04',
              },
            ].map((item, index) => (
              <m.article
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-20% 0px' }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="border-muted-foreground/40 bg-background/80 group flex flex-col gap-3 border border-dashed py-5 shadow-[0_10px_30px_-30px_rgba(0,0,0,0.6)] backdrop-blur"
              >
                <div className="flex items-center justify-between gap-4 px-5">
                  <h3 className="text-lg font-semibold tracking-wider uppercase">{item.title}</h3>
                  <span className="border-muted-foreground/40 text-muted-foreground px-2 py-1 text-[10px] tracking-[0.3em] uppercase">
                    {item.tag}
                  </span>
                </div>
                <p className="text-muted-foreground px-5 text-sm leading-relaxed uppercase">
                  {item.summary}
                </p>
                <div className="border-border h-px w-full border-b border-dashed" />
                <span className="text-primary px-5 text-[10px] tracking-[0.4em] uppercase">
                  State
                </span>
              </m.article>
            ))}
          </div>

          <p className="text-muted-foreground mt-10 hidden text-center text-base leading-6 text-balance uppercase md:block">
            Each escalation step adds a new signal source. Integrations can read the latest state to
            know what to trust and what remains open to dispute.
          </p>
        </div>

        <m.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="border-primary absolute bottom-6 left-6 z-20 size-4 border-b border-l"
        />
        <m.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="border-primary absolute top-6 left-6 z-20 size-4 border-t border-l"
        />
        <m.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="border-primary absolute right-6 bottom-6 z-20 size-4 border-r border-b"
        />
        <m.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="border-primary absolute top-6 right-6 z-20 size-4 border-t border-r"
        />
      </section>
      <span className="border-muted-foreground/50 top-screen pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
