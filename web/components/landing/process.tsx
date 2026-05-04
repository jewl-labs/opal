export default function Process() {
  return (
    <>
      <section className="relative overflow-x-clip">
        <h1 className="text-muted-foreground my-12 text-center text-2xl font-semibold tracking-tight uppercase">
          How it works
        </h1>
        <div className="grid w-full grid-cols-1 gap-4 px-4 pb-12 md:grid-cols-3">
          <div className="h-80 border border-dashed">
            <header className="border-muted-foreground/50 flex items-center justify-between border-b border-dashed p-4">
              <h2 className="font-semibold">01</h2>
              <h2 className="font-semibold">ASSERT</h2>
            </header>
            <div>{/* <Assert /> */}</div>
          </div>
          <div className="h-80 border border-dashed">
            <header className="border-muted-foreground/50 flex items-center justify-between border-b border-dashed p-4">
              <h2 className="font-semibold">02</h2>
              <h2 className="font-semibold">DISPUTE</h2>
            </header>
            <div className="flex items-center justify-center">
              {/* <Dispute /> */}
            </div>
          </div>
          <div className="h-80 border border-dashed">
            <header className="border-muted-foreground/50 flex items-center justify-between border-b border-dashed p-4">
              <h2 className="font-semibold">03</h2>
              <h2 className="font-semibold">ESCALATE</h2>
            </header>
          </div>
        </div>
      </section>
      <span className="border-muted-foreground/50 top-screen pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}

// function Dispute() {
//   return (
//     <svg
//       width="209"
//       height="181"
//       viewBox="0 0 209 181"
//       fill="none"
//       xmlns="http://www.w3.org/2000/svg"
//     >
//       <rect
//         x="0.866025"
//         width="119"
//         height="119"
//         transform="matrix(0.866025 -0.5 0.866025 0.5 0.549009 60.433)"
//         fill="#141414"
//         stroke="#FF6464"
//         strokeDasharray="4 8"
//       />
//       <path d="M0.432983 60L0.432983 120L104.356 180V120" stroke="#FF6464" stroke-dasharray="4 8" />
//       <path d="M208.356 59.8537V119.854L104.433 179.854" stroke="#FF6464" stroke-dasharray="4 8" />
//     </svg>
//   );
// }
