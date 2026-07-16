'use client';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { motion as m } from 'motion/react';

import { cn } from '@/lib/utils';

import CornerMarkers from '../common/corner-markers';
import { Reveal, SectionHeading } from './reveal';

// The on-chain state machine, as the integrator sees it. Liveness states can still
// be challenged; intermediary states are waiting on the next layer; Resolved is
// terminal and the only state where `outcome` is meaningful.
const STATES = [
  {
    name: 'Asserted',
    kind: 'LIVENESS',
    answer: 'Default answer: TRUE',
    text: 'Challengeable until the liveness deadline.',
  },
  {
    name: 'PendingLLM',
    kind: 'INTERMEDIARY',
    answer: 'Answer: pending',
    text: 'First dispute accepted; awaiting the LLM verdict.',
  },
  {
    name: 'AssertedLLM',
    kind: 'LIVENESS',
    answer: 'Answer: LLM outcome',
    text: 'Challengeable until the challenge deadline.',
  },
  {
    name: 'PendingVote',
    kind: 'INTERMEDIARY',
    answer: 'Answer: under challenge',
    text: 'Second dispute accepted; vote round initializing.',
  },
  {
    name: 'Voting',
    kind: 'INTERMEDIARY',
    answer: 'Answer: under challenge',
    text: 'Private USDC-staked vote is live.',
  },
  {
    name: 'Resolved',
    kind: 'TERMINAL',
    answer: 'Outcome is set',
    text: 'Irreversible. Integrators can settle.',
  },
];

const SHORTCUTS = [
  {
    from: 'Asserted',
    label: 'Liveness expires with no dispute',
    to: 'Resolved (True)',
  },
  {
    from: 'AssertedLLM',
    label: 'Challenge window expires',
    to: 'Resolved (LLM outcome)',
  },
];

export default function ResolutionLayers() {
  return (
    <>
      <section className="relative overflow-x-clip px-6 py-32 md:px-16">
        <SectionHeading
          eyebrow="State machine"
          title="State defines the answer"
          sub="One state field tells integrators the current answer, what is still open to dispute, and when settlement is safe."
          className="mb-16"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:gap-2">
          {STATES.map((state, index) => {
            const isLast = index === STATES.length - 1;
            const terminal = state.kind === 'TERMINAL';

            return (
              <m.div
                key={state.name}
                initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true, margin: '-15% 0px' }}
                transition={{ duration: 0.45, delay: index * 0.1 }}
                className="relative flex"
              >
                <div
                  className={cn(
                    'flex w-full flex-col gap-3 border p-5 backdrop-blur transition duration-300',
                    terminal
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border/60 hover:border-border bg-background/70'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'font-mono text-[9px] tracking-[0.25em] uppercase',
                        terminal ? 'text-primary' : 'text-muted-foreground/60'
                      )}
                    >
                      {state.kind}
                    </span>

                    <span
                      className={cn(
                        'size-1.5 rotate-45',
                        terminal ? 'bg-primary' : 'border-muted-foreground/50 border'
                      )}
                    />
                  </div>

                  <h3 className={cn('font-mono text-sm uppercase', terminal && 'text-primary')}>
                    {state.name}
                  </h3>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-foreground/85 text-xs leading-relaxed">
                      {state.answer}
                    </span>

                    <span className="text-muted-foreground text-xs leading-relaxed">
                      {state.text}
                    </span>
                  </div>
                </div>

                {!isLast && (
                  <m.span
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.1 + 0.25 }}
                    className="text-primary/60 absolute top-1/2 -right-3 z-10 hidden -translate-y-1/2 lg:block"
                  >
                    <ArrowRightIcon className="size-4" weight="bold" />
                  </m.span>
                )}
              </m.div>
            );
          })}
        </div>

        <Reveal delay={0.2} className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.from}
              className="border-border/60 bg-background/70 flex flex-wrap items-center gap-x-3 gap-y-1 border border-dashed px-5 py-4 font-mono text-xs tracking-wider uppercase"
            >
              <span className="text-foreground/85">{shortcut.from}</span>
              <ArrowRightIcon className="text-muted-foreground/60 size-3.5" />
              <span className="text-primary">{shortcut.to}</span>
              <span className="text-muted-foreground/60 w-full text-[10px] normal-case sm:ml-auto sm:w-auto">
                {shortcut.label}
              </span>
            </div>
          ))}
        </Reveal>

        <Reveal delay={0.3}>
          <p className="text-muted-foreground mt-10 text-center text-sm leading-6 text-balance">
            Integrator rule: ignore <span className="font-mono text-xs">outcome</span> unless{' '}
            <span className="font-mono text-xs">state == Resolved</span>. Every earlier state is a
            live claim, not a settlement signal.
          </p>
        </Reveal>

        <CornerMarkers />
      </section>
      <span className="border-muted-foreground/50 pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
