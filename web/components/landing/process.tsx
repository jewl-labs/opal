export default function Process() {
  return (
    <section className="relative overflow-x-clip">
      <h1 className="text-muted-foreground my-12 text-center text-2xl font-semibold tracking-tight uppercase">
        How it works
      </h1>
      <div className="grid w-full grid-cols-1 md:grid-cols-3 gap-4 px-4 pb-12">
        <div className="h-80 border border-dashed">
          <header className="border-muted-foreground/50 flex items-center justify-between border-b border-dashed p-4">
            <h2 className="font-semibold">01</h2>
            <h2 className="font-semibold">ASSERT</h2>
          </header>
        </div>
        <div className="h-80 border border-dashed">
          <header className="border-muted-foreground/50 flex items-center justify-between border-b border-dashed p-4">
            <h2 className="font-semibold">02</h2>
            <h2 className="font-semibold">DISPUTE</h2>
          </header>
        </div>
        <div className="h-80 border border-dashed">
          <header className="border-muted-foreground/50 flex items-center justify-between border-b border-dashed p-4">
            <h2 className="font-semibold">03</h2>
            <h2 className="font-semibold">ESCALATE</h2>
          </header>
        </div>
      </div>
      <span className="border-muted-foreground/50 absolute right-0 bottom-0 left-0 h-0.5 border-b border-dashed" />
    </section>
  );
}
