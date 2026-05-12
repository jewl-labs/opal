export default function Footer() {
  return (
    <footer className="relative overflow-hidden pt-8 pb-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="border-muted-foreground/40 flex flex-col items-start justify-between gap-6 border-b border-dashed px-4 pb-8 md:flex-row md:items-center">
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs tracking-[0.4em] uppercase">Opal</span>
            <h2 className="text-2xl font-semibold tracking-tight uppercase">
              Resolution you can rely on
            </h2>
          </div>

          <div className="flex flex-col items-start gap-3 text-sm uppercase md:items-end">
            <span className="text-muted-foreground text-[10px] tracking-[0.3em] uppercase">
              Follow
            </span>
            <a
              href="https://x.com/opaldotsol"
              target="_blank"
              rel="noreferrer"
              className="text-primary undeerline-offset-8 text-sm tracking-[0.2em] transition-opacity hover:underline"
            >X / @opaldotsol</a>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 text-xs uppercase">
          <span className="text-muted-foreground">Built for verifiable outcomes</span>
          <span className="text-muted-foreground">2026</span>
        </div>
      </div>
    </footer>
  );
}
