import Link from 'next/link';

import { Button } from '../ui/button';
import HeroBackground from './background';

export default function Hero() {
  return (
    <>
      <section className="relative flex h-screen items-start justify-center overflow-x-clip pt-40">
        <div className="flex flex-col items-center justify-center gap-4 px-4 md:w-2/3">
          <h1 className="text-center text-7xl font-bold tracking-tight text-balance uppercase md:text-6xl">
            STAKE YOUR <span className="text-primary">TRUTH</span>
          </h1>
          <p className="text-md text-center font-medium tracking-wider text-balance uppercase md:text-xl md:tracking-wide">
            Opal is the optimistic oracle for prediction markets
          </p>
          <div className="flex w-full flex-col justify-center gap-4 pt-16 md:flex-row md:gap-3 md:pt-2">
            <Link href="/assertion/make">
              <Button size="lg" className="w-full">
                Make Assertion
              </Button>
            </Link>
            <Link href="/assertion/browse">
              <Button size="lg" variant="outline" className="w-full">
                Browse Assertions
              </Button>
            </Link>
          </div>
        </div>
        <HeroBackground />
      </section>
        <span className="border-muted-foreground/50 pointer-events-none absolute right-0 top-screen left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
