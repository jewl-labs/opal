import Link from 'next/link';
import { Button } from '../ui/button';
import HeroBackground from './hero-background';

export default function Hero() {
    return (
        <section className="flex h-screen items-end py-24 px-4">
            <div className="w-1/2 space-y-4">
                <h1 className="text-6xl font-bold tracking-tighter text-balance uppercase">
                    OPAL MAKES TRUTH EXPENSIVE TO FAKE.
                </h1>
                <p className="text-xl tracking-wider text-pretty uppercase">
                    Opal is the subjective resolution layer Solana prediction markets have been
                    missing.
                </p>
                <div className="flex gap-3 pt-2">
                    <Link href="/claims/create">
                        <Button size="lg">Assert a Claim</Button>
                    </Link>
                    <Link href="/claims/feed">
                        <Button size="lg" variant="outline">
                            Browse Claims
                        </Button>
                    </Link>
                </div>
            </div>
            <HeroBackground />
        </section>
    );
}
