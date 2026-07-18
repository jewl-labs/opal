'use client';
import Link from 'next/link';

import { motion as m } from 'motion/react';

import CornerMarkers from '../common/corner-markers';
import { Button } from '../ui/button';
import HeroBackground from './background';
import { ParametersRow } from './parameters';

const EASE = [0.22, 1, 0.36, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 22, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.65, ease: EASE } },
};

export default function Hero() {
  return (
    <>
      <section className="relative overflow-x-clip px-6 md:px-16">
        <m.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative flex min-h-[88vh] flex-col items-center justify-center gap-9 pt-24 pb-12"
        >
          <div className="flex max-w-5xl flex-col items-center space-y-5">
            <m.p
              variants={item}
              className="text-primary font-mono text-xs tracking-[0.3em] uppercase"
            >
              Solana-native optimistic oracle
            </m.p>

            <m.h1
              variants={item}
              className="text-center text-4xl text-balance uppercase sm:text-5xl md:text-7xl"
            >
              Stake Your <span className="text-primary">Truth</span>
            </m.h1>

            <m.p
              variants={item}
              className="text-muted-foreground max-w-xl text-center text-sm leading-relaxed text-balance md:text-base"
            >
              Post a claim, back it with USDC, and let it settle as true on its own. Anyone who
              disagrees pays to challenge, and the truth is decided in the open.
            </m.p>
          </div>

          <m.div
            variants={item}
            className="flex w-full flex-col gap-4 sm:flex-row sm:items-center md:justify-center"
          >
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
          </m.div>

          <m.div variants={item} className="mt-10 w-full">
            <ParametersRow />
          </m.div>
        </m.div>

        <HeroBackground />
        <CornerMarkers />
      </section>
      <span className="border-muted-foreground/50 pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />{' '}
    </>
  );
}
