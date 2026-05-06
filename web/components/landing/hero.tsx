import Link from 'next/link';

import { Button } from '../ui/button';
import HeroBackground from './background';
import CornerMarker from '../common/corner-marker';

export default function Hero() {
  return (
    <>
      <section className="relative overflow-x-clip px-4">
        <div className="relative flex min-h-screen flex-col items-center justify-center gap-10 py-12 md:py-16">
          <div className="flex max-w-4xl flex-col items-center space-y-4">
            <p className="text-muted-foreground ring ring-primary px-4 py-1 rounded-full text-xs font-semibold tracking-[0.35em] uppercase">
              Solana-native optimistic oracle
            </p>
            <h1 className="text-center text-7xl font-bold tracking-tight text-balance uppercase md:text-6xl">
              STAKE YOUR <span className="text-primary">TRUTH</span>
            </h1>
            <p className="text-muted-foreground md:text-md max-w-2xl text-center text-base leading-7 text-balance">
              Opal resolves assertions through a default optimistic answer, a first LLM resolution
              round, and a final private voting escalation when the LLM result is disputed.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link href="/assertion/make" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:px-8">
                Make Assertion
              </Button>
            </Link>
            <Link href="/assertion/browse" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:px-8">
                Browse Assertions
              </Button>
            </Link>
          </div>
        </div>
        <HeroBackground />
        <CornerMarker position="bottom"/>
      </section>
      <span className="border-muted-foreground/50 top-screen pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />{' '}
    </>
  );
}
