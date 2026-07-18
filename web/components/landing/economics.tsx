'use client';
import { motion as m } from 'motion/react';

import CornerMarkers from '../common/corner-markers';
import { SectionHeading } from './reveal';

// Bond mechanics, stated plainly: every claim is collateralized, every wrong
// challenge costs its bond, and undecidable statements settle no-fault.
const MECHANICS = [
  {
    step: '01',
    title: 'Bond to assert',
    text: 'Every statement is posted with a USDC bond. If nobody disputes it before the liveness deadline, it finalizes True and the bond comes back.',
  },
  {
    step: '02',
    title: 'Stake to dispute',
    text: 'Disputing costs a matching bond and routes the statement to LLM resolution. An incorrect dispute is slashed; a correct one is paid from the loser.',
  },
  {
    step: '03',
    title: 'Escalate to a vote',
    text: 'Challenging the LLM verdict opens a private USDC-staked vote with linear weight. An outcome needs a supermajority to become final.',
  },
  {
    step: '04',
    title: 'No-fault settlement',
    text: 'If the statement cannot be decided under its Resolution Spec, it settles Unresolvable: nobody is slashed and every bond is returned.',
  },
];

export default function Economics() {
  return (
    <>
      <section className="relative overflow-x-clip px-6 py-32 md:px-16">
        <SectionHeading
          eyebrow="Economics"
          title="Every answer is collateralized"
          sub="Truth-telling is the only strategy that doesn't lose money. Wrong assertions and wrong disputes forfeit their bonds to whoever corrected them."
          className="mb-16"
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {MECHANICS.map((item, index) => (
            <m.article
              key={item.step}
              initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '-15% 0px' }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="border-border/50 hover:border-border bg-background/70 group flex h-full flex-col gap-5 border p-6 backdrop-blur transition duration-300 ease-out"
            >
              <span className="text-muted-foreground group-hover:text-primary font-mono text-xs tracking-[0.3em] uppercase transition duration-300 ease-out">
                {item.step}
              </span>

              <h3 className="text-sm uppercase">{item.title}</h3>

              <p className="text-muted-foreground text-sm leading-relaxed">{item.text}</p>
            </m.article>
          ))}
        </div>

        <CornerMarkers />
      </section>
      <span className="border-muted-foreground/50 pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
