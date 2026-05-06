'use client';

import { DitheredWaves } from 'ditherwave';

export default function HeroBackground() {
  return (
    <div>
      <div className="absolute inset-0 -z-30 mask-t-from-40% mask-r-from-40% mask-b-from-40% mask-l-from-40% opacity-30">
        <DitheredWaves
          waveColor="#bbf047"
          baseColor="#141414"
          pixelSize={8}
          colorNum={1}
          matrixSize={8}
          waveAmplitude={0.2}
        />
      </div>
      <div className="bg-background/25 absolute inset-0 -z-20" />
    </div>
  );
}