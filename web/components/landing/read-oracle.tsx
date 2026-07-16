'use client';
import { motion as m } from 'motion/react';

import CornerMarkers from '../common/corner-markers';
import { SectionHeading } from './reveal';

// Integrator-facing panel: one PDA per assertion, and the state field is the
// entire trust model. Field names mirror the on-chain account.
const ACCOUNT_LINES: { key: string; value: string; comment?: string; accent?: boolean }[] = [
  { key: 'state', value: 'Resolved', comment: 'only Resolved is terminal', accent: true },
  { key: 'outcome', value: 'True', comment: 'meaningful once Resolved', accent: true },
  { key: 'dispute_count', value: '2' },
  { key: 'liveness_deadline', value: '1782050400' },
  { key: 'llm_resolution_round', value: '→ LlmResolutionRound' },
  { key: 'vote_resolution_round', value: '→ VoteResolutionRound' },
  { key: 'auxiliary_hash', value: '0x9f2c…b310', comment: 'pins the Resolution Spec' },
];

const GUARANTEES = [
  {
    title: 'Trust only Resolved',
    text: 'Every earlier state is an open claim. The state machine tells you exactly what is still challengeable.',
  },
  {
    title: 'One account to read',
    text: 'Current state, round pointers, dispute count, and the final outcome live on a single assertion PDA.',
  },
  {
    title: 'Spec-pinned answers',
    text: 'The account stores the hash of the Resolution Spec, the document that defines how the statement resolves.',
  },
  {
    title: 'Corrections are new assertions',
    text: 'A resolved assertion is never mutated. If the world changes, a new assertion carries the correction.',
  },
];

export default function ReadOracle() {
  return (
    <>
      <section className="relative overflow-x-clip px-6 py-32 md:px-16">
        <SectionHeading
          eyebrow="For integrators"
          title="One account. The state is the answer."
          className="mb-16"
        />

        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {GUARANTEES.map((item, index) => (
              <m.div
                key={item.title}
                initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true, margin: '-15% 0px' }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                className="border-border/50 hover:border-border bg-background/70 flex h-full flex-col gap-3 border p-6 backdrop-blur transition duration-300"
              >
                <span className="text-muted-foreground font-mono text-xs tracking-[0.3em] uppercase">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <h3 className="text-sm uppercase">{item.title}</h3>

                <p className="text-muted-foreground text-sm leading-relaxed">{item.text}</p>
              </m.div>
            ))}
          </div>

          <m.div
            initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-15% 0px' }}
            transition={{ duration: 0.45 }}
            className="border-border bg-background/80 flex flex-col border backdrop-blur"
          >
            <div className="border-border flex items-center justify-between border-b px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="bg-primary size-1.5" />
                <span className="text-muted-foreground font-mono text-[11px] tracking-[0.2em] uppercase">
                  AssertionAccount
                </span>
              </div>

              <span className="text-muted-foreground/50 font-mono text-[10px] tracking-widest uppercase">
                PDA
              </span>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-3 overflow-x-auto p-6 font-mono text-xs md:text-sm">
              {ACCOUNT_LINES.map((line, index) => (
                <m.div
                  key={line.key}
                  initial={{ opacity: 0, x: 8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-15% 0px' }}
                  transition={{ duration: 0.3, delay: 0.3 + index * 0.08 }}
                  className="flex items-baseline gap-3 whitespace-nowrap"
                >
                  <span className="text-muted-foreground">{line.key}:</span>

                  <span className={line.accent ? 'text-primary' : 'text-foreground'}>
                    {line.value}
                  </span>

                  {line.comment && (
                    <span className="text-muted-foreground/50 ml-auto text-[11px]">
                      {`// ${line.comment}`}
                    </span>
                  )}
                </m.div>
              ))}
            </div>

            <div className="border-border text-muted-foreground/60 border-t px-6 py-3.5 font-mono text-[10px] tracking-widest uppercase">
              getAccountInfo → decode → trust state
            </div>
          </m.div>
        </div>

        <CornerMarkers />
      </section>
      <span className="border-muted-foreground/50 pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
