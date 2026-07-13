'use client';
import { useRef, useState } from 'react';

import { AnimatePresence, motion as m, useScroll, useSpring } from 'motion/react';

import { cn } from '@/lib/utils';

import CornerMarkers from '../common/corner-markers';
import { SectionHeading } from './reveal';

// How many program calls each escalation depth takes, start to settlement.
const PATHS = [
  { label: 'Undisputed', route: 'create → finalize', calls: 2 },
  { label: 'One dispute', route: 'create → dispute → LLM → finalize', calls: 4 },
  { label: 'Full escalation', route: 'create → dispute → challenge → vote → finalize', calls: 7 },
];

// The protocol's instruction flow, one call per escalation step. Names mirror
// programs/opal; the rail on the left draws itself as the reader scrolls.
const STEPS = [
  {
    name: 'create_assertion',
    state: 'Asserted',
    text: 'The statement and its Resolution Spec hash go on-chain, the USDC bond is locked, and the liveness clock starts. Default answer: True.',
  },
  {
    name: 'dispute_assertion',
    state: 'PendingLLM',
    text: 'A bonded dispute during the liveness window moves the assertion to PendingLLM and opens the LLM resolution round.',
  },
  {
    name: 'submit_mock_llm_resolution',
    state: 'AssertedLLM',
    text: 'The LLM verdict is posted and verified on-chain. The assertion becomes AssertedLLM and the challenge window opens.',
  },
  {
    name: 'challenge_llm_resolution',
    state: 'PendingVote',
    text: 'A second bonded dispute challenges the LLM outcome, records what was challenged, and initializes the vote round.',
  },
  {
    name: 'open_vote',
    state: 'Voting',
    text: 'Vote state is delegated to the private rollup and the voting window is set. The assertion moves from PendingVote to Voting.',
  },
  {
    name: 'cast_vote',
    state: 'Voting',
    text: 'Voters lock USDC behind an outcome with linear weight: one staked USDC is one vote. Ballots stay sealed while the window is open.',
  },
  {
    name: 'finalize_*',
    state: 'Resolved',
    text: 'finalize_undisputed, finalize_llm_resolution, or finalize_vote_resolution sets the terminal outcome, settles every bond, and closes the assertion.',
  },
];

export default function InstructionFlow() {
  const railRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ['start 0.75', 'end 0.55'],
  });
  const drawn = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.6 });

  // The step currently crossing the middle of the viewport drives the left panel.
  const [active, setActive] = useState(0);
  const activeStep = STEPS[active] ?? STEPS[0]!;

  return (
    <>
      <section className="relative overflow-x-clip px-6 py-32 md:px-16">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex flex-col gap-8 lg:sticky lg:top-32 lg:self-start">
            <SectionHeading
              align="left"
              eyebrow="Instruction flow"
              title="From statement to settlement"
              sub="Every escalation is one permissioned-or-permissionless instruction on the program. No bots, no committees on the happy path."
            />

            <m.div
              initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '-15% 0px' }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="hidden flex-col gap-4 lg:flex"
            >
              <div className="text-muted-foreground/60 flex items-baseline justify-between font-mono text-[10px] tracking-[0.3em] uppercase">
                <span>Now reading</span>

                <span className="tabular-nums">
                  {String(active + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
                </span>
              </div>

              <div className="relative min-h-36">
                <AnimatePresence mode="wait">
                  <m.div
                    key={activeStep.name}
                    initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="flex flex-col gap-3"
                  >
                    <h3 className="text-primary font-mono text-lg tracking-wider lowercase">
                      {activeStep.name}
                    </h3>

                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {activeStep.text}
                    </p>

                    <span className="text-muted-foreground/60 font-mono text-[10px] tracking-[0.2em] uppercase">
                      State after call:{' '}
                      <span className="text-foreground/80">{activeStep.state}</span>
                    </span>
                  </m.div>
                </AnimatePresence>
              </div>

              <div className="flex gap-1">
                {STEPS.map((step, index) => (
                  <span
                    key={step.name}
                    className={cn(
                      'h-px flex-1 transition-colors duration-300',
                      index <= active ? 'bg-primary' : 'bg-muted-foreground/20'
                    )}
                  />
                ))}
              </div>
            </m.div>

            <div className="flex flex-col">
              {PATHS.map((path) => (
                <div
                  key={path.label}
                  className="border-border/50 flex items-center justify-between gap-4 border-t py-3.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs tracking-widest uppercase">
                      {path.label}
                    </span>

                    <span className="text-muted-foreground text-xs leading-relaxed">
                      {path.route}
                    </span>
                  </div>

                  <span className="text-primary shrink-0 font-mono text-lg tabular-nums">
                    {path.calls}
                    <span className="text-muted-foreground/60 ml-1.5 text-[10px] tracking-widest uppercase">
                      calls
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div ref={railRef} className="relative">
            <span className="bg-muted-foreground/15 absolute top-2 bottom-2 left-[5px] w-px" />
            <m.span
              style={{ scaleY: drawn }}
              className="bg-primary/70 absolute top-2 bottom-2 left-[5px] w-px origin-top"
            />

            <div className="flex flex-col gap-12">
              {STEPS.map((step, index) => (
                <m.div
                  key={step.name}
                  onViewportEnter={() => setActive(index)}
                  viewport={{ margin: '-45% 0px -50% 0px' }}
                  className="relative pl-10"
                >
                  <span
                    className={cn(
                      'border-background absolute top-1.5 left-0 size-[11px] rotate-45 border-2 transition-colors duration-300',
                      index <= active ? 'bg-primary' : 'bg-muted-foreground/40'
                    )}
                  />

                  <m.div
                    initial={{ opacity: 0, x: 14, filter: 'blur(8px)' }}
                    whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    viewport={{ once: true, margin: '-20% 0px' }}
                    transition={{ duration: 0.45, delay: 0.05 }}
                    className={cn(
                      'transition-opacity duration-300',
                      index === active ? 'opacity-100' : 'opacity-60'
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-primary font-mono text-sm tracking-wider lowercase md:text-base">
                        {step.name}
                      </h3>

                      <span className="text-muted-foreground/50 font-mono text-[10px] tracking-[0.25em] tabular-nums">
                        {String(index + 1).padStart(2, '0')} /{' '}
                        {String(STEPS.length).padStart(2, '0')}
                      </span>
                    </div>

                    <p className="text-muted-foreground mt-2.5 max-w-xl text-sm leading-relaxed">
                      {step.text}
                    </p>
                  </m.div>
                </m.div>
              ))}
            </div>
          </div>
        </div>

        <CornerMarkers />
      </section>
      <span className="border-muted-foreground/50 pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
