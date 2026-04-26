'use client';

import heroBg from '../../assets/img/hero-background.png';

export default function HeroBackground() {
  return (
    <div>
      <div className="absolute inset-0 -z-30 mask-t-from-50% mask-r-from-90% mask-b-from-40% mask-l-from-10% opacity-50 mix-blend-soft-light saturate-400">
        <img src={heroBg} className="fill" alt="" />
      </div>
      <div className="bg-background/25 absolute inset-0 -z-20 backdrop-blur-[1px]" />
    </div>
  );
}
