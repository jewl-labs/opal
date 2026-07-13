'use client';
import { useState } from 'react';

import { PlusIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion as m } from 'motion/react';

import { cn } from '@/lib/utils';

import CornerMarkers from '../common/corner-markers';
import { Reveal, SectionHeading } from './reveal';

const QUESTIONS = [
  {
    q: 'What is an assertion?',
    a: 'A natural-language statement posted with a USDC bond and a Resolution Spec that defines how it should be judged. It defaults to True and anyone can dispute it during the liveness window.',
  },
  {
    q: 'Why is the default answer True?',
    a: 'Optimistic resolution keeps the honest path cheap: most true statements are never disputed and finalize without any resolution work. The bond exists so that posting falsehoods is the expensive path.',
  },
  {
    q: 'What happens when someone disputes?',
    a: 'The first dispute routes the statement to an LLM resolver, which posts a verdict under the Resolution Spec. That verdict can itself be challenged, escalating to a private USDC-staked vote where a supermajority decides.',
  },
  {
    q: 'What does Unresolvable mean?',
    a: 'The statement cannot be decided under its spec: it is ambiguous, evidence conflicts, or no outcome reached the supermajority. It settles no-fault: nobody is slashed and all bonds are returned.',
  },
  {
    q: 'When can my app trust the answer?',
    a: 'Only at Resolved. Every earlier state is still open to dispute, and the assertion account tells you exactly which window is currently running. Settlement at Resolved is irreversible.',
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <>
      <section className="relative overflow-x-clip px-6 py-32 md:px-16">
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="FAQ" title="Common questions" className="mb-12" />

          <Reveal delay={0.1} className="border-border border-t">
            {QUESTIONS.map((item, index) => {
              const isOpen = openIndex === index;

              return (
                <div key={item.q} className="border-border border-b">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="hover:bg-muted/30 flex w-full cursor-pointer items-center justify-between gap-4 px-1 py-5 text-left transition-colors"
                  >
                    <span
                      className={cn(
                        'font-mono text-sm tracking-wider uppercase transition-colors',
                        isOpen ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {item.q}
                    </span>

                    <m.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(isOpen ? 'text-primary' : 'text-muted-foreground/60')}
                    >
                      <PlusIcon className="size-4" />
                    </m.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <m.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <p className="text-muted-foreground max-w-2xl px-1 pb-6 text-sm leading-relaxed">
                          {item.a}
                        </p>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </Reveal>
        </div>

        <CornerMarkers />
      </section>
      <span className="border-muted-foreground/50 pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
