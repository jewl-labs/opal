'use client';

import { motion as m } from 'motion/react';

interface ClaimTextProps {
    id: string | undefined;
    claim: string | undefined;
}

export default function ClaimText({ id, claim }: ClaimTextProps) {
    return (
        <m.h1 layout layoutId={`claim-${id}`} className="w-fit text-4xl font-semibold tracking-tight">
            {claim}
        </m.h1>
    );
}
