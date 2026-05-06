'use client';

import Image from 'next/image';

export default function HeroBackground() {
  return (
    <div>
      <div className="absolute inset-0 -z-30 mask-t-from-50% mask-r-from-90% mask-b-from-40% mask-l-from-10% opacity-75 mix-blend-soft-light saturate-400">
        <Image src="/img/hero-background.png" className="fill" alt="" fill />
      </div>
      <div className="bg-background/25 absolute inset-0 -z-20" />
    </div>
  );
}