'use client';
import Image from 'next/image';

export default function HeroBackground() {
    return (
        <div>
            <div className="absolute inset-0 -z-30 mask-t-from-50% mask-r-from-90% mask-b-from-40% mask-l-from-10% mix-blend-soft-light saturate-400 opacity-50">
                <Image
                    src="/img/noisy_image_1.webp"
                    alt=""
                    width={1263.94}
                    height={682}
                    className="absolute inset-0 z-0 w-full opacity-12 mix-blend-overlay"
                />
                <Image
                    src="/img/noisy_image_2.webp"
                    alt=""
                    width={1440}
                    height={777}
                    className="absolute inset-0 z-0 w-full opacity-8 blur-xs"
                />
                <Image src="/img/hero-background.png" fill alt="" />
            </div>
            <div className="bg-background/25 absolute inset-0 -z-20 backdrop-blur-[1px]" />
        </div>
    );
}
