'use client';
import { motion as m } from 'motion/react';

import CornerMarkers from '../common/corner-markers';
import { SectionHeading } from './reveal';

export default function Consumer() {
  return (
    <>
      <section className="relative overflow-x-clip px-6 py-32 md:px-16">
        <SectionHeading
          eyebrow="Audiences"
          title="Built for integrators, challengers, and protocol operators"
          className="mb-16"
        />

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
              text: 'The MagicBlock integration is reserved in accounts, but v1 does not require it to be live.',
            },
          ].map((item, index) => (
            <m.article
              key={item.title}
              initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '-15% 0px' }}
              transition={{ duration: 0.45, delay: (index % 2) * 0.08 }}
              className="border-border/50 hover:border-border bg-background/70 group flex h-full flex-col border py-6 shadow-sm backdrop-blur transition duration-300 ease-out"
            >
              <header className="border-border/50 group-hover:border-border flex items-center justify-between gap-4 border-b px-6 pb-4">
                <h3 className="text-sm uppercase">{item.title}</h3>
                <span className="bg-primary/50 group-hover:bg-primary size-1.5 rotate-45 transition-colors duration-300" />
              </header>
              <p className="text-muted-foreground mt-5 px-6 text-sm leading-relaxed text-balance">
                {item.text}
              </p>
            </m.article>
          ))}
        </div>

        <CornerMarkers />
      </section>
      <span className="border-muted-foreground/50 top-screen pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
