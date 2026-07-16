import Image from 'next/image';
import Link from 'next/link';

import CornerMarkers from '../common/corner-markers';

const PROTOCOL_LINKS = [
  { label: 'Browse Assertions', href: '/assertion/browse' },
  { label: 'Make Assertion', href: '/assertion/make' },
];

const PRINCIPLES = ['Default True', 'Disputable', 'Final at Resolved'];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden">
      <div className="relative flex w-full flex-col">
        <div className="relative grid grid-cols-1 gap-12 px-6 py-20 md:grid-cols-12 md:px-16">
          <div className="flex flex-col gap-6 md:col-span-6">
            <div className="flex items-center gap-1">
              <span className="relative size-9 -translate-y-0.5 overflow-hidden">
                <Image
                  src="/img/logo.svg"
                  fill
                  alt="Opal logo"
                  className="scale-175 object-cover"
                />
              </span>
              <span className="font-heading text-lg uppercase">Opal</span>
            </div>

            <h2 className="max-w-md text-2xl leading-snug uppercase md:text-3xl">
              Resolution you <span className="text-primary">can rely on</span>
            </h2>

            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              A Solana-native optimistic oracle for natural-language statements.
            </p>

            <div className="flex flex-wrap gap-2">
              {PRINCIPLES.map((principle) => (
                <span
                  key={principle}
                  className="border-border/70 text-muted-foreground border px-2.5 py-1 font-mono text-[10px] tracking-[0.2em] uppercase"
                >
                  {principle}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-5 md:col-span-3 md:col-start-8">
            <span className="text-primary font-mono text-[10px] tracking-[0.3em] uppercase">
              Protocol
            </span>

            <nav className="flex flex-col gap-4">
              {PROTOCOL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-foreground/80 hover:text-primary group flex items-center gap-2.5 font-mono text-xs tracking-widest uppercase transition-colors"
                >
                  <span className="bg-muted-foreground/40 group-hover:bg-primary size-1 rotate-45 transition-colors" />
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-5 md:col-span-2">
            <span className="text-primary font-mono text-[10px] tracking-[0.3em] uppercase">
              Follow
            </span>

            <a
              href="https://x.com/opaldotsol"
              target="_blank"
              rel="noreferrer"
              className="text-foreground/80 hover:text-primary group flex w-fit items-center gap-2.5 font-mono text-xs tracking-widest uppercase transition-colors"
            >
              <span className="bg-muted-foreground/40 group-hover:bg-primary size-1 rotate-45 transition-colors" />
              @opaldotsol
              <span className="text-muted-foreground/50 group-hover:text-primary transition-colors">
                ↗
              </span>
            </a>
          </div>
        </div>

        <div className="border-border/70 flex flex-col items-start justify-between gap-3 border-t px-6 py-6 font-mono text-[11px] tracking-widest uppercase sm:flex-row sm:items-center md:px-16">
          <span className="text-muted-foreground/70">Built for verifiable outcomes</span>
          <div className="flex items-center gap-8">
            <span className="text-muted-foreground flex items-center gap-2 tracking-wider">
              <span className="bg-primary size-1.5 animate-pulse" />
              Solana Devnet
            </span>
            <span className="text-muted-foreground/70 tabular-nums">
              {new Date().getFullYear()}
            </span>
          </div>
        </div>

        <CornerMarkers />
      </div>
    </footer>
  );
}
