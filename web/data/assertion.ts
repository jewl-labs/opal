import type { AssertionAccount, ResolutionOutcome } from '@/types';

export const ASSERTION_BOND_PUSD = 500;

// Canonical demo persona — asserter, disputer, and voter across the seed set so every
// dashboard tab has data to show until on-chain reads land. Reachable from the dashboard
// empty state and via ⌘K search.
export const DEMO_USER = 'DemoUser7mXvLqRtY4dFcHbJeUoSiAzXn';

export const ASSERTIONS: AssertionAccount[] = [
  {
    id: '8xKpQ3mN7vLwRtY2dFcHbJeUoSiAzXnP',
    asserter: DEMO_USER,
    statement: "Kanye West's Delhi concert got postponed",
    auxiliaryHash: 'a3f8c2d1e4b7091f6a5c3d2e1b8f7a09',
    auxiliaryUrl: 'https://arweave.net/abc123',
    bondAmountPUSD: ASSERTION_BOND_PUSD,
    state: 'Asserted',
    livenessDeadline: '2026-08-15T14:00:00Z', // future — dispute window open
    outcome: null,
    finalizedAt: null,
    disputeCount: 0,
    llmDispute: null,
    voteDispute: null,
    llmResolutionRound: null,
    voteResolutionRound: null,
    createdAt: '2026-04-26T12:00:00Z',
  },

  {
    id: '9yLqR4nO8wMxStZ3eGdIcKfVpTjBaYoQ',
    asserter: 'Fh6jVoM1lWuKpSqX3eGdIcKfVpTjBaYo',
    statement: 'AI passes Turing Test in 2026',
    auxiliaryHash: 'b4g9d3e2f5c8102g7b6d4e3c2a9g8b10',
    auxiliaryUrl: 'https://arweave.net/def456',
    bondAmountPUSD: ASSERTION_BOND_PUSD,
    state: 'AssertedLLM',
    livenessDeadline: '2026-04-20T10:00:00Z',
    outcome: null,
    finalizedAt: null,
    disputeCount: 1,
    llmDispute: {
      pubkey: 'LLMd1Kp7mNvQrXtZ2wFcHbJeUoSiAzYn',
      disputer: DEMO_USER,
      bondAmountPUSD: ASSERTION_BOND_PUSD,
      createdAt: '2026-04-21T08:00:00Z',
      settlementResolution: null,
      disputeCorrect: null,
      settled: false,
    },
    voteDispute: null,
    llmResolutionRound: {
      pubkey: 'LLMr2Nq8oOwRyU4xHdJfKgWpViCbZmEs',
      outcomeCode: 1,
      outcome: 'False',
      resolvedAt: '2026-04-22T09:00:00Z',
      challengeDeadline: '2026-08-10T09:00:00Z', // future — challenge window open
    },
    voteResolutionRound: null,
    createdAt: '2026-04-18T16:00:00Z',
  },

  {
    id: '3zMrS5oP9xNyTuA4fHeJdLgWqUkCbZmE',
    asserter: 'Ei4hToK8jUsMoRpV1dFbGcIbJeVlAzWn',
    statement: 'Mars colony established by 2030',
    auxiliaryHash: 'd6i1f5g4h7e0324i9d8f6g5e4c1i0d12',
    auxiliaryUrl: 'https://arweave.net/ghi789',
    bondAmountPUSD: ASSERTION_BOND_PUSD,
    state: 'Voting',
    livenessDeadline: '2026-04-10T12:00:00Z',
    outcome: null,
    finalizedAt: null,
    disputeCount: 2,
    llmDispute: {
      pubkey: 'LLMd3Op9qPrSuV5yIdKhLiXqWrUlDcAn',
      disputer: 'Ch3gSnJ7iToLnQoU9cEaFbHdJfUkAyVm',
      bondAmountPUSD: ASSERTION_BOND_PUSD,
      createdAt: '2026-04-11T10:00:00Z',
      settlementResolution: null,
      disputeCorrect: null,
      settled: false,
    },
    voteDispute: {
      pubkey: 'VTDd4Pq0rQsTvW6zJeLiMjYrXsVmEdBo',
      disputer: DEMO_USER,
      challengedLLMResolution: 'Unresolvable',
      bondAmountPUSD: ASSERTION_BOND_PUSD,
      createdAt: '2026-04-19T14:00:00Z',
      settlementResolution: null,
      disputeCorrect: null,
      settled: false,
    },
    llmResolutionRound: {
      pubkey: 'LLMr4Qr1sRtUwX7aKfMjNkZsYtWnFeCp',
      outcomeCode: 3,
      outcome: 'Unresolvable',
      promptHash: 'e7j2g6h5i8f1435j0e9g7h6f5d2j1e13',
      resolvedAt: '2026-04-17T11:00:00Z',
      challengeDeadline: '2026-04-19T11:00:00Z',
    },
    voteResolutionRound: {
      pubkey: 'VTRr5Rs2tSuVxY8bLgNkOlAtZuXoGfDq',
      votingStartsAt: '2026-04-20T12:00:00Z',
      votingDeadline: '2026-05-01T12:00:00Z',
      totalValidWeight: 48200n,
      // False holds ~69% of the weight — above the 6700 bps supermajority.
      aggregateVotes: {
        True: 0,
        False: 33400,
        Unresolvable: 14800,
      },
      voters: [
        { voter: DEMO_USER, outcome: 'False', weight: 12000 },
        { voter: 'Ch3gSnJ7iToLnQoU9cEaFbHdJfUkAyVm', outcome: 'False', weight: 9400 },
        { voter: 'Uf7dHcY7bLkCeGgL8sUpYrZtBuLkUqNfP', outcome: 'Unresolvable', weight: 8000 },
      ],
      finalOutcome: 'False',
    },
    createdAt: '2026-04-08T09:00:00Z',
  },

  {
    id: '6cPuV8rS2aQbWxD7iKhMgNjZtXlFeCpH',
    asserter: 'Bf6hQmJ7kUpLnNoV9cGwHdIeKgUmBxYo',
    statement: 'Fusion energy powers a city grid',
    auxiliaryHash: 'j2o7l1m0n3k6980o5j4l2m1k0i7o6j18',
    auxiliaryUrl: 'https://arweave.net/pqr678',
    bondAmountPUSD: ASSERTION_BOND_PUSD,
    state: 'PendingLLM',
    livenessDeadline: '2026-04-25T10:00:00Z',
    outcome: null,
    finalizedAt: null,
    disputeCount: 1,
    llmDispute: {
      pubkey: 'LLMd9Yz9aZbBdF5iSnToUrGzGbEvNkLx',
      disputer: 'Zb2dMhD2gQlHjLlQ3xZuCwEzGzQhZvSk',
      bondAmountPUSD: ASSERTION_BOND_PUSD,
      createdAt: '2026-04-26T06:00:00Z',
      settlementResolution: null,
      disputeCorrect: null,
      settled: false,
    },
    voteDispute: null,
    llmResolutionRound: {
      pubkey: 'LLMr0Za0bAcCeG6jToUpVsHaHcFwOlMy',
      outcomeCode: 0,
      outcome: null, // pending — the resolver has not posted yet
      promptHash: 'k3p8m2n1o4l7091p6k5m3n2l1j8p7k19',
      resolvedAt: null,
      challengeDeadline: null,
    },
    voteResolutionRound: null,
    createdAt: '2026-04-23T15:00:00Z',
  },

  {
    id: '9fSxY1uV5dTeZaG0lNkPjQmCwAoIfFsK',
    asserter: 'Ci9kToM0nXsOqQrY2fJzKgLhNjXpEcBr',
    statement: 'We won the Frontier Hackathon',
    auxiliaryHash: 'o7t2q6r5s8p1435t0o9q7r6p5n2t1o23',
    auxiliaryUrl: 'https://arweave.net/vwx234',
    bondAmountPUSD: ASSERTION_BOND_PUSD,
    state: 'PendingVote',
    livenessDeadline: '2026-04-18T10:00:00Z',
    outcome: null,
    finalizedAt: null,
    disputeCount: 2,
    llmDispute: {
      pubkey: 'LLMd3CdDeFgHiJ9mWrXsYvKdKfIzRoPb',
      disputer: 'Xb0bKfB0eOnFhJjO1vXsBuCwExOnXtQi',
      bondAmountPUSD: ASSERTION_BOND_PUSD,
      createdAt: '2026-04-19T10:00:00Z',
      settlementResolution: null,
      disputeCorrect: null,
      settled: false,
    },
    voteDispute: {
      pubkey: 'VTDd4DeEfGhIjK0nXsYtZwLeLgJaSpQc',
      disputer: 'Wc9cJeA9dNmEgIiN0uWrAtBvDwNmWsPhR',
      challengedLLMResolution: 'False',
      bondAmountPUSD: ASSERTION_BOND_PUSD,
      createdAt: '2026-04-24T09:00:00Z',
      settlementResolution: null,
      disputeCorrect: null,
      settled: false,
    },
    llmResolutionRound: {
      pubkey: 'LLMr4EfFgHiJkL1oYtZuAwMfMhKbTqRd',
      outcomeCode: 1,
      outcome: 'False',
      resolvedAt: '2026-04-22T11:00:00Z',
      challengeDeadline: '2026-04-24T11:00:00Z',
    },
    voteResolutionRound: {
      pubkey: 'VTRr5FgGhIjKlM2pZuAvBxNgNiLcUrSe',
      votingStartsAt: null,
      votingDeadline: null,
      totalValidWeight: 0n,
      aggregateVotes: {
        True: 0,
        False: 0,
        Unresolvable: 0,
      },
      finalOutcome: null,
    },
    createdAt: '2026-04-17T08:00:00Z',
  },

  {
    id: '2gTyZ3vW6eUfAbH1mOlQrNdXbPjKgLtM',
    asserter: 'Dj8lUpN1oYtPrRsZ3gKaLhMiOkYqFdCs',
    statement: 'OpenAI releases GPT-6 before 2027',
    auxiliaryHash: 'q9v4s8t7u0r3657v2q1s9t8r7p4v3q25',
    auxiliaryUrl: 'https://arweave.net/yza567',
    bondAmountPUSD: ASSERTION_BOND_PUSD,
    state: 'Resolved',
    livenessDeadline: '2026-03-12T09:00:00Z',
    outcome: 'False',
    finalizedAt: '2026-03-15T10:00:00Z',
    disputeCount: 1,
    llmDispute: {
      pubkey: 'LLMd5GhHiJkLmN3qAvBwCyOhOjMdVsTf',
      disputer: DEMO_USER,
      bondAmountPUSD: ASSERTION_BOND_PUSD,
      createdAt: '2026-03-13T08:00:00Z',
      settlementResolution: 'False',
      disputeCorrect: true,
      settled: true,
    },
    voteDispute: null,
    llmResolutionRound: {
      pubkey: 'LLMr6HiIjKlMnO4rBwCxDzPiPkNeWtUg',
      outcomeCode: 1,
      outcome: 'False',
      resolvedAt: '2026-03-14T09:00:00Z',
      challengeDeadline: '2026-03-15T09:00:00Z',
    },
    voteResolutionRound: null,
    createdAt: '2026-03-10T07:00:00Z',
  },

  {
    id: '1hUzA4wX7fVgBcI2nPmRsOeYcQkLhMuN',
    asserter: 'Ek7mVqO2pZuQsStA4hLbMiNjPlZrGeDt',
    statement: 'India wins FIFA World Cup 2026',
    auxiliaryHash: 's1x6u0v9w2t5879x4s3u1v0t9r6x5s27',
    auxiliaryUrl: 'https://arweave.net/bcd890',
    bondAmountPUSD: ASSERTION_BOND_PUSD,
    state: 'Resolved',
    livenessDeadline: '2026-02-20T12:00:00Z',
    outcome: 'Unresolvable',
    finalizedAt: '2026-02-24T11:30:00Z',
    disputeCount: 2,
    // Unresolvable settles no-fault: both bonds returned, disputeCorrect stays null.
    llmDispute: {
      pubkey: 'LLMd7IjJkLmNoP5sCxDyEaQjQlOfXuVh',
      disputer: 'Uf7dHcY7bLkCeGgL8sUpYrZtBuLkUqNfP',
      bondAmountPUSD: ASSERTION_BOND_PUSD,
      createdAt: '2026-02-21T07:00:00Z',
      settlementResolution: 'Unresolvable',
      disputeCorrect: null,
      settled: true,
    },
    voteDispute: {
      pubkey: 'VTDd8JkKlMnOpQ6tDyEzFbRkRmPgYwWi',
      disputer: 'Tg6cGbX6aKjBdFfK7rToXqYsAtKjTpMeO',
      challengedLLMResolution: 'Unresolvable',
      bondAmountPUSD: ASSERTION_BOND_PUSD,
      createdAt: '2026-02-22T10:00:00Z',
      settlementResolution: 'Unresolvable',
      disputeCorrect: null,
      settled: true,
    },
    llmResolutionRound: {
      pubkey: 'LLMr9KlLmNoPqR7uEzFaGcSlSnQhZxXj',
      outcomeCode: 3,
      outcome: 'Unresolvable',
      promptHash: 't2y7v1w0x3u6980y5t4v2w1u0s7y6t28',
      resolvedAt: '2026-02-22T08:30:00Z',
      challengeDeadline: '2026-02-23T08:30:00Z',
    },
    voteResolutionRound: {
      pubkey: 'VTRr0MnNoPqRsT8vFaGbHdTmToRiAyYk',
      votingStartsAt: '2026-02-23T12:00:00Z',
      votingDeadline: '2026-02-24T10:00:00Z',
      totalValidWeight: 38700n,
      // Unresolvable holds ~83% of the weight — above the supermajority.
      aggregateVotes: {
        True: 2300,
        False: 4200,
        Unresolvable: 32200,
      },
      voters: [
        { voter: DEMO_USER, outcome: 'Unresolvable', weight: 9000 },
        { voter: 'Tg6cGbX6aKjBdFfK7rToXqYsAtKjTpMeO', outcome: 'Unresolvable', weight: 15000 },
        { voter: 'Uf7dHcY7bLkCeGgL8sUpYrZtBuLkUqNfP', outcome: 'False', weight: 4200 },
      ],
      finalOutcome: 'Unresolvable',
    },
    createdAt: '2026-02-18T09:30:00Z',
  },

  {
    id: '0iVaB5xY8gWhCdJ3oQnStPfZdRlMiVoP',
    asserter: DEMO_USER,
    statement: 'World population exactly 9B by Jan 2027',
    auxiliaryHash: 'u3z8w2x1y4v7091z6u5w3x2v1t8z7u29',
    auxiliaryUrl: 'https://arweave.net/efg123',
    bondAmountPUSD: ASSERTION_BOND_PUSD,
    state: 'Resolved',
    livenessDeadline: '2026-01-15T12:00:00Z',
    outcome: 'Unresolvable',
    finalizedAt: '2026-01-18T15:00:00Z',
    disputeCount: 1,
    llmDispute: {
      pubkey: 'LLMd1OpPqRsTuV9wGbHcIeUnUqSjBzZl',
      disputer: 'Sh5bFaW5zJiAcEeJ6qSnWpXrZsJiSoLdN',
      bondAmountPUSD: ASSERTION_BOND_PUSD,
      createdAt: '2026-01-16T09:00:00Z',
      // No-fault settlement — Unresolvable returns the bond without slashing.
      settlementResolution: 'Unresolvable',
      disputeCorrect: null,
      settled: true,
    },
    voteDispute: null,
    llmResolutionRound: {
      pubkey: 'LLMr2QrRsTuVwX0xHcIdJfVoVrTkCaAm',
      outcomeCode: 3,
      outcome: 'Unresolvable',
      resolvedAt: '2026-01-17T10:00:00Z',
      challengeDeadline: '2026-01-18T10:00:00Z',
    },
    voteResolutionRound: null,
    createdAt: '2026-01-12T11:00:00Z',
  },

  {
    id: '4jWbC6yZ9hXiDeK4pRoTuQgAeSmNjWqR',
    asserter: 'Gm7oXsQ4rBwSuUvC6jNdOkPlRnBtIgFv',
    statement: 'Bitcoin traded above $100k in June 2026',
    auxiliaryHash: 'w5b0y4z3a6x9213b8w7y5z4x3v0b9w31',
    auxiliaryUrl: 'https://arweave.net/hij456',
    bondAmountPUSD: ASSERTION_BOND_PUSD,
    state: 'Asserted',
    livenessDeadline: '2026-06-28T12:00:00Z', // expired — finalize_undisputed available
    outcome: null,
    finalizedAt: null,
    disputeCount: 0,
    llmDispute: null,
    voteDispute: null,
    llmResolutionRound: null,
    voteResolutionRound: null,
    createdAt: '2026-06-21T12:00:00Z',
  },

  {
    id: '5kXcD7zA0iYjEfL5qSpUvRhBfTnOkXrS',
    asserter: 'Hn8pYtR5sCxTvVwD7kOeQlQmSoCuJhGw',
    statement: 'EU approved a spot Ethereum ETF before June 2026',
    auxiliaryHash: 'x6c1z5a4b7y0324c9x8z6a5y4w1c0x32',
    auxiliaryUrl: 'https://arweave.net/klm789',
    bondAmountPUSD: ASSERTION_BOND_PUSD,
    state: 'AssertedLLM',
    livenessDeadline: '2026-06-05T10:00:00Z',
    outcome: null,
    finalizedAt: null,
    disputeCount: 1,
    llmDispute: {
      pubkey: 'LLMd2ReSfTgUhV0xJdKeLfWpWsUlDbBm',
      disputer: 'In9qZuS6tDyUwWxE8lPfRmRnTpDvKiHx',
      bondAmountPUSD: ASSERTION_BOND_PUSD,
      createdAt: '2026-06-06T09:00:00Z',
      settlementResolution: null,
      disputeCorrect: null,
      settled: false,
    },
    voteDispute: null,
    llmResolutionRound: {
      pubkey: 'LLMr3SfTgUhViW1yKeLfMgXqXtVmEcCn',
      outcomeCode: 1,
      outcome: 'False',
      promptHash: 'y7d2a6b5c8z1435d0y9a7b6z5x2d1y33',
      resolvedAt: '2026-06-08T10:00:00Z',
      challengeDeadline: '2026-06-10T10:00:00Z', // expired — finalize_llm_resolution available
    },
    voteResolutionRound: null,
    createdAt: '2026-06-04T08:00:00Z',
  },
];

export function filterAssertionsByAddress(
  address?: string | string[] | null,
  source: AssertionAccount[] = ASSERTIONS
) {
  const normalized = Array.isArray(address) ? address[0] : address;
  if (!normalized) return [];

  return source.filter((assertion) => {
    if (assertion.asserter === normalized) return true;
    if (assertion.llmDispute?.disputer === normalized) return true;
    if (assertion.voteDispute?.disputer === normalized) return true;
    return false;
  });
}

export interface UserVoteEntry {
  assertion: AssertionAccount;
  outcome: ResolutionOutcome; // how this address voted
  weight: number;
}

// Every vote the address has cast, read from the per-voter records on each vote round
// (seed data plus votes cast this session via `castVote`).
export function votesByAddress(
  address?: string | string[] | null,
  source: AssertionAccount[] = ASSERTIONS
): UserVoteEntry[] {
  const normalized = Array.isArray(address) ? address[0] : address;
  if (!normalized) return [];

  const entries: UserVoteEntry[] = [];
  for (const assertion of source) {
    const record = assertion.voteResolutionRound?.voters?.find((v) => v.voter === normalized);
    if (record) entries.push({ assertion, outcome: record.outcome, weight: record.weight });
  }
  return entries;
}
