'use client';
import Link from 'next/link';

import { motion as m } from 'motion/react';

import CornerMarkers from '../common/corner-markers';
import { Button } from '../ui/button';

export default function Cta() {
  return (
    <>
      <section className="relative overflow-x-clip px-6 py-32 md:px-16">
        <m.div
          initial={{ opacity: 0, y: 12, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: 0.45 }}
          className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center"
        >
          <p className="text-primary font-mono text-xs tracking-[0.3em] uppercase">
            Default true · Disputable · Final at Resolved
          </p>

          <h2 className="text-3xl text-balance uppercase md:text-5xl">
            Post a statement.
            <br />
            Let the market check it.
          </h2>

          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed text-balance">
            Assertions finalize on their own unless someone pays to disagree. Every escalation makes
            the answer more expensive to fake.
          </p>

          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center">
            <Link href="/assertion/make" className="w-full sm:w-auto">
              <Button size="lg" className="w-full uppercase sm:px-8">
                Make Assertion
              </Button>
            </Link>

            <Link href="/assertion/browse" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full uppercase sm:px-8">
                Browse Assertions
              </Button>
            </Link>
          </div>
        </m.div>

        <CornerMarkers />
      </section>
      <span className="border-muted-foreground/50 pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
