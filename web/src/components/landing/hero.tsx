import { Button } from '../ui/button';
import HeroBackground from './background';

export default function Hero() {
  return (
    <section className="relative flex h-[90vh] items-center p-4 md:items-end">
      <div className="space-y-4 text-center md:w-1/2 md:text-left">
        <h1 className="text-4xl font-bold tracking-tighter text-balance uppercase md:text-5xl">
          OPAL MAKES TRUTH EXPENSIVE TO FAKE.
        </h1>
        <p className="text-xl font-medium tracking-wider text-balance uppercase md:tracking-wide md:text-pretty">
          Opal is the subjective resolution layer Solana prediction markets have
          been missing.
        </p>
        <div className="flex w-full flex-col md:gap-3 gap-4 md:pt-2 pt-16 md:flex-row">
          <a href="/statement/create">
            <Button size="lg" className="w-full">
              Assert a Claim
            </Button>
          </a>
          <a href="/statement/feed">
            <Button size="lg" variant="outline" className="w-full">
              Browse Claims
            </Button>
          </a>
        </div>
      </div>
      <HeroBackground />
      <span className="border-muted-foreground/50 absolute -inset-x-64 bottom-0 h-0.5 border-b border-dashed" />
    </section>
  );
}
