'use client';

import Link from 'next/link';
import { motion as m } from 'motion/react';
import { TimerIcon } from 'lucide-react';

export type ClaimStatus = 'proposed' | 'voting' | 'resolved';

export interface ClaimCardProps {
    id: string;
    claim: string;
    status: string;
    bond: number;
    dispute: {
        window: number;
        count: number;
    };
}

export default function ClaimCard(data: ClaimCardProps) {
    return (
        <Link href={`/claims/feed/${data.id}`}>
            <m.div
                layout
                layoutId={`claim-card-${data.id}`}
                className="bg-muted/30 hover:bg-muted/55 group ring-accent flex h-36 w-full cursor-pointer justify-between rounded-lg p-4 shadow-2xs ring transition-colors duration-300 ease-in-out"
            >
                <div className="flex flex-col">
                    <m.h2
                        layout
                        layoutId={`claim-${data.id}`}
                        className="text-2xl font-semibold tracking-tight"
                    >
                        {data.claim}
                    </m.h2>
                    <h2>
                        Bond: <span>{data.bond} OPAL</span>
                    </h2>
                    <div className="flex items-center gap-1">
                        <TimerIcon className="size-4" />
                        <span className="font-medium">{data.dispute.window}Hr</span>
                    </div>
                </div>
                <div className="flex w-fit flex-col items-end justify-between">
                    <span className="bg-orange-900/25 px-2 py-1 text-xs tracking-tighter text-orange-300 uppercase shadow-2xl">
                        {data.status}
                    </span>
                </div>
            </m.div>
        </Link>
    );
}
