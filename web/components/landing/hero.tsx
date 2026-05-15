'use client';
import Link from 'next/link';

import { motion as m } from 'motion/react';

import { Button } from '../ui/button';
import HeroBackground from './background';

export default function Hero() {
  return (
    <>
      <section className="relative overflow-x-clip px-4">
        <div className="relative flex min-h-[90vh] translate-y-8 flex-col items-center justify-center gap-10 py-12 md:py-16">
          <div className="flex max-w-4xl flex-col items-center space-y-4">
            <p className="text-primary text-xs font-semibold tracking-[0.35em] uppercase">
              Solana-native optimistic oracle
            </p>
            <h1 className="mt-4 text-center text-4xl font-bold tracking-tighter text-balance uppercase md:text-6xl">
              Stake Your <span className="text-primary">Truth</span>
            </h1>
            <p className="text-muted-foreground max-w-3xl text-center text-sm leading-7 font-medium text-balance uppercase md:text-sm">
              Opal resolves assertions through a default optimistic answer, a first LLM resolution
              round, and a final private voting escalation.
            </p>
          </div>

          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center md:justify-center">
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
        </div>
        <HeroBackground />
        <m.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.2, repeat: Infinity }}
          className="border-primary absolute bottom-4 left-4 z-20 size-4 border-b border-l"
        />
        <m.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.2, repeat: Infinity }}
          className="border-primary absolute top-20 left-4 z-20 size-4 border-t border-l"
        />
        <m.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.2, repeat: Infinity }}
          className="border-primary absolute right-4 bottom-4 z-20 size-4 border-r border-b"
        />
        <m.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.2, repeat: Infinity }}
          className="border-primary absolute top-20 right-4 z-20 size-4 border-t border-r"
        />
      </section>
      <span className="border-muted-foreground/50 pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />{' '}
    </>
  );
}
