'use client';
import { motion as m } from 'motion/react';

export default function Consumer() {
  return (
    <>
      <section className="relative overflow-x-clip px-4 py-24">
        <div className="mx-auto mb-16 max-w-3xl">
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-balance uppercase md:text-4xl">
            Built for integrators
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            {
              title: 'Prediction markets',
              text: 'Settle subjective markets only after the assertion reaches Resolved. Read the state machine and wait for the terminal outcome.',
            },
            {
              title: 'Disputers',
              text: 'Challenge optimistic defaults or questionable LLM outputs for direct economic upside. The protocol rewards accurate disputes.',
            },
            {
              title: 'Builders',
              text: 'One assertion PDA exposes current state, round pointers, dispute count, and the final answer for downstream apps.',
            },
            {
              title: 'Future operators',
              text: 'Switchboard, Nosana, and MagicBlock integrations are reserved in accounts, but v1 does not require them to be live.',
            },
          ].map((item) => (
            <article
              key={item.title}
              className="border-border/50 hover:border-border bg-background/70 group flex h-full flex-col border border-dashed py-6 shadow-sm backdrop-blur transition duration-300 ease-out"
            >
              <header className="border-border/50 group-hover:border-border flex items-center justify-between gap-4 border-b border-dashed px-6 pb-4">
                <h3 className="text-xs font-semibold tracking-tight uppercase">{item.title}</h3>
                <span className="text-muted-foreground group-hover:text-primary text-xs font-semibold tracking-[0.35em] uppercase transition duration-300 ease-out">
                  Opal
                </span>
              </header>
              <p className="text-muted-foreground mt-5 px-6 text-xs leading-7 text-balance uppercase">
                {item.text}
              </p>
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
