import Container from '@/components/common/container';
import ClaimText from '@/components/claims/claim-text';
import { ChevronRight, ZapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CLAIM_DATA } from '../claim-data';

interface ClaimPrope {
    params: { slug: Promise<string> };
}

export default async function Claim({ params }: ClaimPrope) {
    const { slug } = await params;
    const id = await slug;
    const claim = CLAIM_DATA.find((c) => c.id === id);

    return (
        <Container className="py-16">
            <header className="flex items-center justify-between border-b border-dashed p-4">
                <h2 className="text-sm font-semibold tracking-tight uppercase">#{claim?.id}</h2>
                <h2>
                    Status:{' '}
                    <span className="text-sm font-semibold tracking-tight text-orange-300 uppercase">
                        {claim?.status}
                    </span>
                </h2>
            </header>
            <div className="flex justify-between px-4">
                <div className="flex flex-col gap-8 py-8">
                    <ClaimText id={claim?.id} claim={claim?.claim} />
                    <Button variant="destructive" size="lg" className="w-fit">
                        <ZapIcon />
                        <span>DIspute this Claim</span>
                    </Button>
                </div>
                <Timeline />
            </div>
        </Container>
    );
}

function Timeline() {
    return (
        <div className="relative flex h-[80vh] w-fit flex-col py-8">
            {/* top node */}
            <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs whitespace-nowrap uppercase">
                    25 Jan 2026
                </span>
                <span className="text-xs whitespace-nowrap uppercase">Proposed</span>
                <ChevronRight className="size-3" />
                <span className="ring-secondary z-10 size-2 shrink-0 rounded-full bg-orange-400 ring-2" />
            </div>

            {/* line */}
            <svg
                width="1"
                className="mr-[3px] ml-auto flex-1"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
            >
                <line
                    x1="0.5"
                    x2="0.5"
                    y1="0"
                    y2="100%"
                    strokeDasharray="8 8"
                    className="stroke-muted-foreground/50"
                />
            </svg>

            {/* bottom node */}
            <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs whitespace-nowrap uppercase">
                    02 Feb 2026
                </span>
                <span className="text-xs whitespace-nowrap uppercase">Resolved</span>
                <ChevronRight className="size-3" />
                <span className="ring-secondary z-10 size-2 shrink-0 rounded-full bg-green-400 ring-2" />
            </div>
        </div>
    );
}
