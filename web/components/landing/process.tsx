import CornerMarker from '../common/corner-marker';

export default function Process() {
  return (
    <>
      <section className="relative overflow-x-clip px-4 py-32">
        <div className="mb-16 flex flex-col items-center gap-4">
          <h2 className="mt-3 text-3xl font-bold tracking-tight uppercase md:text-4xl">
            Resolution advances in three layers
          </h2>
          <p className="text-muted-foreground hidden text-center text-base leading-6 text-balance md:block">
            {' '}
            Each layer is economical and terminal settlement is only available once the assertion is
            fully resolved.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="border-border/80 bg-background/70 group min-h-80 border py-6 shadow-sm backdrop-blur">
            <header className="border-muted-foreground/40 flex items-center justify-between border-b border-dashed px-6 pb-4">
              <span className="text-muted-foreground text-xs font-semibold tracking-[0.35em] uppercase">
                01
              </span>
              <span className="text-muted-foreground group-hover:text-primary text-xs font-semibold tracking-[0.35em] uppercase transition-colors duration-300 ease-out">
                Assert
              </span>
            </header>
            <div className="flex h-full flex-col items-center justify-end pb-12">
              <AssertIllustration />
              <p className="text-muted-foreground mt-6 text-center text-xs text-balance uppercase">
                Post assertion & bond. Default answer: True.
              </p>
            </div>
          </article>
          <article className="border-border/80 group bg-background/70 min-h-80 border py-6 shadow-sm backdrop-blur">
            <header className="border-muted-foreground/40 flex items-center justify-between border-b border-dashed px-6 pb-4">
              <span className="text-muted-foreground text-xs font-semibold tracking-[0.35em] uppercase">
                02
              </span>
              <span className="text-muted-foreground group-hover:text-primary text-xs font-semibold tracking-[0.35em] uppercase transition-colors duration-300 ease-out">
                Dispute
              </span>
            </header>
            <div className="flex h-full flex-col items-center justify-end pb-12">
              <DisputeIllustration />
              <p className="text-muted-foreground mt-6 text-center text-xs text-balance uppercase">
                First dispute opens the LLM round.
              </p>
            </div>
          </article>
          <article className="border-border/80 group bg-background/70 min-h-80 border py-6 shadow-sm backdrop-blur">
            <header className="border-muted-foreground/40 flex items-center justify-between border-b border-dashed px-6 pb-4">
              <span className="text-muted-foreground text-xs font-semibold tracking-[0.35em] uppercase">
                03
              </span>
              <span className="text-muted-foreground group-hover:text-primary text-xs font-semibold tracking-[0.35em] uppercase transition-colors duration-300 ease-out">
                Escalate
              </span>
            </header>
            <div className="flex h-full flex-col items-center justify-end pb-12">
              <EscalateIllustration />
              <p className="text-muted-foreground mt-6 text-center text-xs leading-6 text-balance uppercase">
                Second dispute opens private voting; settlement on Resolved.
              </p>
            </div>
          </article>
        </div>
        <CornerMarker position="bottom" />
      </section>
      <span className="border-muted-foreground/50 pointer-events-none absolute right-0 left-0 z-20 h-0.5 w-screen border-b border-dashed" />
    </>
  );
}

function AssertIllustration() {
  return (
    <svg
      width="208"
      height="330"
      viewBox="0 0 208 330"
      className="w-full scale-75"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g id="Group 10">
        <g id="box-1">
          <rect
            id="Rectangle 2"
            x="0.866025"
            width="119"
            height="119"
            transform="matrix(0.866025 -0.5 0.866025 0.5 0.116025 210.433)"
            fill="#141414"
            stroke="white"
          />
          <rect
            id="Rectangle 3"
            x="0.433013"
            y="0.75"
            width="119"
            height="59"
            transform="matrix(0.866025 0.5 0 1 0.0580127 209.783)"
            fill="#141414"
            stroke="white"
          />
          <rect
            id="Rectangle 4"
            x="0.433013"
            y="0.25"
            width="119"
            height="59"
            transform="matrix(0.866025 -0.5 0 1 104.058 270.07)"
            fill="#141414"
            stroke="white"
          />
        </g>
        <g id="box-2">
          <rect
            id="Rectangle 2_2"
            x="0.866025"
            width="119"
            height="119"
            transform="matrix(0.866025 -0.5 0.866025 0.5 0.116025 150.433)"
            fill="#141414"
            stroke="white"
          />
          <rect
            id="Rectangle 3_2"
            x="0.433013"
            y="0.75"
            width="119"
            height="59"
            transform="matrix(0.866025 0.5 0 1 0.0580127 149.783)"
            fill="#141414"
            stroke="white"
          />
          <rect
            id="Rectangle 4_2"
            x="0.433013"
            y="0.25"
            width="119"
            height="59"
            transform="matrix(0.866025 -0.5 0 1 104.058 210.07)"
            fill="#141414"
            stroke="white"
          />
        </g>
        <g id="box-3">
          <rect
            id="Rectangle 2_3"
            x="0.866025"
            width="119"
            height="119"
            transform="matrix(0.866025 -0.5 0.866025 0.5 0.116025 60.433)"
            fill="#141414"
            stroke="#FFC95C"
            strokeDasharray="4 8"
          />
          <rect
            id="Rectangle 3_3"
            x="0.433013"
            y="0.75"
            width="119"
            height="59"
            transform="matrix(0.866025 0.5 0 1 0.0580127 59.7835)"
            fill="#141414"
            stroke="#FFC95C"
            strokeDasharray="4 8"
          />
          <rect
            id="Rectangle 4_3"
            x="0.433013"
            y="0.25"
            width="119"
            height="59"
            transform="matrix(0.866025 -0.5 0 1 104.058 120.07)"
            fill="#141414"
            stroke="#FFC95C"
            strokeDasharray="4 8"
          />
        </g>
      </g>
    </svg>
  );
}

function DisputeIllustration() {
  return (
    <svg
      width="209"
      height="180"
      viewBox="0 0 209 180"
      fill="none"
      className="w-full scale-75"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0.866025"
        width="119"
        height="119"
        transform="matrix(0.866025 -0.5 0.866025 0.5 0.549009 60.433)"
        fill="#141414"
        stroke="#FF6464"
        strokeDasharray="2 2"
      />
      <path
        d="M0.432983 59.1463L0.432983 119.146L104.356 179.146V119.146"
        stroke="#FF6464"
        strokeDasharray="2 2"
      />
      <path d="M208.279 59V119L104.356 179" stroke="#FF6464" strokeDasharray="2 2" />
    </svg>
  );
}

function EscalateIllustration() {
  return (
    <svg
      width="208"
      height="270"
      viewBox="0 0 208 270"
      fill="none"
      className="w-full scale-75"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0.866025"
        width="119"
        height="119"
        transform="matrix(0.866025 -0.5 0.866025 0.5 0.116025 150.433)"
        fill="#141414"
        stroke="#83FF75"
        strokeDasharray="4 8"
      />
      <path d="M104.923 89.8537V149.854L1 209.854" stroke="#868686" strokeDasharray="4 8" />
      <rect
        x="0.433013"
        y="0.75"
        width="119"
        height="59"
        transform="matrix(0.866025 0.5 0 1 0.0580127 149.783)"
        fill="#141414"
        stroke="#83FF75"
        strokeDasharray="4 8"
      />
      <path d="M104 90V150L207.923 210" stroke="#868686" strokeDasharray="4 8" />
      <rect
        x="0.433013"
        y="0.25"
        width="119"
        height="59"
        transform="matrix(0.866025 -0.5 0 1 104.058 210.07)"
        fill="#141414"
        stroke="#83FF75"
        strokeDasharray="4 8"
      />
      <rect
        x="0.866025"
        width="119"
        height="119"
        transform="matrix(0.866025 -0.5 0.866025 0.5 0.116025 60.433)"
        fill="#141414"
        stroke="#83FF75"
        strokeDasharray="4 8"
      />
    </svg>
  );
}
