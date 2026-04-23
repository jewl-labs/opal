import { ClaimCardProps } from '@/components/claims/claim-card';

export const CLAIM_DATA: ClaimCardProps[] = [
    {
        id: 'cd0c2e88-b407-4c20-9141-2d492169f453',
        claim: "Kanye West's Delhi concert got postponed",
        status: 'proposed',
        bond: 50,
        dispute: {
            window: 14,
            count: 0,
        },
    },
    {
        id: 'cd0c2e88-b407-8ab1-9141-2d492179f453',
        claim: 'AI passes Turing Test in 2026',
        status: 'resolved',
        bond: 100,
        dispute: {
            window: 7,
            count: 2,
        },
    },
    {
        id: 'cd0c2e88-b407-9cd2-9141-2d492180f453',
        claim: 'Mars colony established by 2030',
        status: 'voting',
        bond: 75,
        dispute: {
            window: 21,
            count: 1,
        },
    },
    {
        id: 'cd0c2e88-b407-1ef3-9141-2d492181f453',
        claim: 'Quantum computing breaks RSA encryption',
        status: 'proposed',
        bond: 60,
        dispute: {
            window: 30,
            count: 0,
        },
    },
    {
        id: 'cd0c2e88-b407-2gh4-9141-2d492182f453',
        claim: 'First human teleported by 2040',
        status: 'proposed',
        bond: 5,
        dispute: {
            window: 60,
            count: 0,
        },
    },
    {
        id: 'cd0c2e88-b407-3ij5-9141-2d492183f453',
        claim: 'Global internet via satellites',
        status: 'resolved',
        bond: 40,
        dispute: {
            window: 12,
            count: 1,
        },
    },
    {
        id: 'cd0c2e88-b407-4kl6-9141-2d492184f453',
        claim: 'Ocean cleanup removes 90% of plastic',
        status: 'voting',
        bond: 30,
        dispute: {
            window: 18,
            count: 0,
        },
    },
    {
        id: 'cd0c2e88-b407-5mn7-9141-2d492185f453',
        claim: 'Fusion energy powers a city',
        status: 'proposed',
        bond: 80,
        dispute: {
            window: 25,
            count: 3,
        },
    },
    {
        id: 'cd0c2e88-b407-6op8-9141-2d492186f453',
        claim: 'Self-driving cars dominate roads',
        status: 'voting',
        bond: 55,
        dispute: {
            window: 15,
            count: 1,
        },
    },
    {
        id: 'cd0c2e88-b407-7sc5-9141-2d492178f999',
        claim: 'We won the Frontier Hackathon',
        status: 'proposed',
        bond: 10,
        dispute: {
            window: 10,
            count: 0,
        },
    },
];
