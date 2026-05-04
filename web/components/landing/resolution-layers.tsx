export default function ResolutionLayers() {
  return (
    <>
      <section className="relative grid grid-cols-1 overflow-x-clip md:grid-cols-2">
        <div>
          <h1 className="text-muted-foreground my-12 text-center text-2xl font-semibold tracking-tight uppercase">
            Resolution Layers
          </h1>
        </div>
        <div className="grid w-full grid-cols-1 gap-4 px-4 py-12">
          <div className="h-80 border border-dashed">
            <header className="border-muted-foreground/50 flex items-center justify-between border-b border-dashed p-4">
              <h2 className="font-semibold uppercase">Optimistic Default</h2>
              <h2 className="font-semibold uppercase">Layer 1</h2>
            </header>
          </div>
          <div className="h-80 border border-dashed">
            <header className="border-muted-foreground/50 flex items-center justify-between border-b border-dashed p-4">
              <h2 className="font-semibold uppercase">LLM Resolution</h2>
              <h2 className="font-semibold uppercase">Layer 2</h2>
            </header>
          </div>
          <div className="h-80 border border-dashed">
            <header className="border-muted-foreground/50 flex items-center justify-between border-b border-dashed p-4">
              <h2 className="font-semibold uppercase">Private Vote</h2>
              <h2 className="font-semibold uppercase">Layer 3</h2>
            </header>
          </div>
        </div>
      </section>
      <span className="border-muted-foreground/50 top-screen pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}
