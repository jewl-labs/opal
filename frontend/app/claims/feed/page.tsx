'use client';

import ClaimCard, { ClaimCardProps } from '@/components/claims/claim-card';
import Header from '@/components/claims/header';
import Container from '@/components/common/container';
import { useState } from 'react';
import { CLAIM_DATA } from './claim-data';

export default function ClaimsFeed() {
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [claims, setClaims] = useState<ClaimCardProps[]>([...CLAIM_DATA]);

    const handleToggleSort = () => {
        const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        setSortOrder(newOrder);
        setClaims((prev: ClaimCardProps[]) =>
            [...prev].sort((a, b) => (newOrder === 'asc' ? a.bond - b.bond : b.bond - a.bond))
        );
    };

    return (
        <Container className="pt-16">
            <Header sortOrder={sortOrder} onToggleSort={handleToggleSort} />
            <div className="grid grid-cols-1 gap-4 px-4 py-24">
                {claims.map((data) => (
                    <ClaimCard key={data.id} {...data} />
                ))}
            </div>
        </Container>
    );
}
