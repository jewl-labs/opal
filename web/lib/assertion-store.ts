'use client';

import { useSyncExternalStore } from 'react';

import { ASSERTIONS } from '@/data/assertion';
import type { AssertionAccount, ResolutionOutcome } from '@/types';

// Client-side in-memory store seeded from the mock data. It lets created assertions
// and mock state transitions survive navigation (make → browse → detail) until real
// on-chain reads replace it. Resets on hard refresh.
let assertions: AssertionAccount[] = ASSERTIONS;

// Local record of the connected user's cast vote per assertion id. Mock — real voting
// will read this from the voter's on-chain vote account. Resets on hard refresh.
let userVotes: Record<string, ResolutionOutcome> = {};
const EMPTY_USER_VOTES: Record<string, ResolutionOutcome> = {};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return assertions;
}

function getServerSnapshot() {
  return ASSERTIONS;
}

export function useAssertions() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function getUserVotesSnapshot() {
  return userVotes;
}

function getUserVotesServerSnapshot() {
  return EMPTY_USER_VOTES;
}

export function useUserVote(id: string | undefined): ResolutionOutcome | null {
  const votes = useSyncExternalStore(subscribe, getUserVotesSnapshot, getUserVotesServerSnapshot);
  return (id && votes[id]) || null;
}

export function addAssertion(assertion: AssertionAccount) {
  assertions = [assertion, ...assertions];
  emit();
}

export function updateAssertion(
  id: string,
  update: (assertion: AssertionAccount) => AssertionAccount
) {
  assertions = assertions.map((assertion) => (assertion.id === id ? update(assertion) : assertion));
  emit();
}

// --- Mock protocol transitions ---------------------------------------------------------
// These mirror the programs/opal instructions and are the seams where real transaction
// submission will replace store updates. No on-chain calls are made yet.

const OUTCOME_CODES: Record<ResolutionOutcome, 0 | 1 | 3> = {
  True: 0,
  False: 1,
  Unresolvable: 3,
};

// A single outcome must reach this weighted share of the vote or the round settles
// Unresolvable. Mirrors ProtocolConfig.supermajority_bps (a config field, not a constant
// on-chain — 6700 matches the program tests).
export const SUPERMAJORITY_BPS = 6700;

// Applies the supermajority rule to a tally: the leading outcome wins only if it holds
// at least SUPERMAJORITY_BPS of the total weight; otherwise the vote is Unresolvable.
function tallyOutcome(aggregateVotes: Record<ResolutionOutcome, number>): ResolutionOutcome {
  const entries = Object.entries(aggregateVotes) as [ResolutionOutcome, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total === 0) return 'Unresolvable';
  const [leading, weight] = entries.reduce((top, candidate) =>
    candidate[1] > top[1] ? candidate : top
  );
  return weight * 10_000 >= total * SUPERMAJORITY_BPS ? leading : 'Unresolvable';
}

// Settlement is no-fault when the outcome is Unresolvable: both bonds are returned and
// nobody is slashed, so disputeCorrect stays null even though the dispute is settled.
function disputeCorrectness(outcome: ResolutionOutcome, challenged: ResolutionOutcome | null) {
  if (outcome === 'Unresolvable') return null;
  return outcome !== (challenged ?? 'True');
}

// Short mock windows so the full lifecycle stays walkable in one session.
const MOCK_CHALLENGE_WINDOW_MS = 5 * 60 * 1000;
const MOCK_VOTING_WINDOW_MS = 5 * 60 * 1000;

// Mirrors `dispute_assertion` — challenges the default optimistic TRUE.
export function fileLlmDispute(id: string, disputer: string) {
  const now = new Date().toISOString();
  updateAssertion(id, (prev) => ({
    ...prev,
    state: 'PendingLLM',
    disputeCount: 1,
    llmDispute: {
      pubkey: `MOCK_LLM_DISPUTE_${prev.id}`,
      disputer,
      bondAmountPUSD: prev.bondAmountPUSD,
      createdAt: now,
      settlementResolution: null,
      disputeCorrect: null,
      settled: false,
    },
    llmResolutionRound: {
      pubkey: `MOCK_LLM_ROUND_${prev.id}`,
      outcomeCode: 0,
      outcome: null,
      promptHash: 'pending',
      resolvedAt: null,
      challengeDeadline: null,
    },
  }));
}

// Mirrors `submit_mock_llm_resolution` — the trusted LLM resolver posts its verdict.
// Mock: the chosen outcome stands in for the resolver's verdict.
export function submitLlmResolution(id: string, outcome: ResolutionOutcome) {
  const now = new Date();
  updateAssertion(id, (prev) => {
    if (!prev.llmResolutionRound) return prev;
    return {
      ...prev,
      state: 'AssertedLLM',
      llmResolutionRound: {
        ...prev.llmResolutionRound,
        outcomeCode: OUTCOME_CODES[outcome],
        outcome,
        resolvedAt: now.toISOString(),
        challengeDeadline: new Date(now.getTime() + MOCK_CHALLENGE_WINDOW_MS).toISOString(),
      },
    };
  });
}

// Mirrors `challenge_llm_resolution` — challenges the proposed LLM outcome.
export function fileVoteDispute(id: string, disputer: string) {
  const now = new Date().toISOString();
  updateAssertion(id, (prev) => {
    if (!prev.llmResolutionRound) return prev;
    return {
      ...prev,
      state: 'PendingVote',
      disputeCount: 2,
      voteDispute: {
        pubkey: `MOCK_VOTE_DISPUTE_${prev.id}`,
        disputer,
        challengedLLMResolution: prev.llmResolutionRound.outcome,
        bondAmountPUSD: prev.bondAmountPUSD,
        createdAt: now,
        settlementResolution: null,
        disputeCorrect: null,
        settled: false,
      },
      voteResolutionRound: {
        pubkey: `MOCK_VOTE_ROUND_${prev.id}`,
        votingStartsAt: null,
        votingDeadline: null,
        totalValidWeight: 0n,
        aggregateVotes: { True: 0, False: 0, Unresolvable: 0 },
        finalOutcome: null,
      },
    };
  });
}

// Mirrors `open_vote` — permissionless; sets the voting window.
export function openVote(id: string) {
  const startsAt = new Date();
  const deadline = new Date(startsAt.getTime() + MOCK_VOTING_WINDOW_MS);
  updateAssertion(id, (prev) => {
    if (!prev.voteResolutionRound) return prev;
    return {
      ...prev,
      state: 'Voting',
      voteResolutionRound: {
        ...prev.voteResolutionRound,
        votingStartsAt: startsAt.toISOString(),
        votingDeadline: deadline.toISOString(),
      },
    };
  });
}

// Mock USDC stake. Weight is linear (1 staked USDC = 1 vote); real voting runs sealed
// on a MagicBlock ephemeral rollup and is not wired yet.
export const MOCK_VOTE_WEIGHT = 5000;

// Mock vote casting — real sealed MagicBlock voting is not wired yet. finalOutcome is
// kept as a provisional read of the tally under the supermajority rule.
export function castVote(id: string, outcome: ResolutionOutcome, weight: number, voter: string) {
  userVotes = { ...userVotes, [id]: outcome };
  updateAssertion(id, (prev) => {
    if (!prev.voteResolutionRound) return prev;
    const aggregateVotes = { ...prev.voteResolutionRound.aggregateVotes };
    // A wallet votes once per round: back out this voter's prior vote (if any) before
    // counting the new one, so a re-vote replaces rather than double-counts.
    const prior = (prev.voteResolutionRound.voters ?? []).find((v) => v.voter === voter);
    if (prior) {
      aggregateVotes[prior.outcome] -= prior.weight;
    }
    aggregateVotes[outcome] += weight;
    // Record the individual vote so it surfaces on the voter's dashboard. A wallet votes
    // once per round, so replace any prior record from the same voter.
    const voters = [
      ...(prev.voteResolutionRound.voters ?? []).filter((v) => v.voter !== voter),
      { voter, outcome, weight },
    ];

    return {
      ...prev,
      voteResolutionRound: {
        ...prev.voteResolutionRound,
        aggregateVotes,
        voters,
        totalValidWeight:
          prev.voteResolutionRound.totalValidWeight + BigInt(weight) - BigInt(prior?.weight ?? 0),
        finalOutcome: tallyOutcome(aggregateVotes),
      },
    };
  });
}

// Mirrors `finalize_undisputed` / `finalize_llm_resolution` / `finalize_vote_resolution`
// depending on the current state. Sets the terminal outcome and settles dispute bonds.
export function finalizeAssertion(id: string) {
  const now = new Date().toISOString();
  updateAssertion(id, (prev) => {
    if (prev.state === 'Asserted') {
      return { ...prev, state: 'Resolved', outcome: 'True', finalizedAt: now };
    }

    if (prev.state === 'AssertedLLM' && prev.llmResolutionRound?.outcome) {
      const outcome = prev.llmResolutionRound.outcome;
      return {
        ...prev,
        state: 'Resolved',
        outcome,
        finalizedAt: now,
        llmDispute: prev.llmDispute && {
          ...prev.llmDispute,
          settlementResolution: outcome,
          // The first dispute challenges the optimistic default True; Unresolvable
          // settles no-fault (bond returned, disputeCorrect stays null).
          disputeCorrect: disputeCorrectness(outcome, null),
          settled: true,
        },
      };
    }

    if (prev.state === 'Voting' && prev.voteResolutionRound) {
      const outcome = tallyOutcome(prev.voteResolutionRound.aggregateVotes);

      return {
        ...prev,
        state: 'Resolved',
        outcome,
        finalizedAt: now,
        voteResolutionRound: { ...prev.voteResolutionRound, finalOutcome: outcome },
        llmDispute: prev.llmDispute && {
          ...prev.llmDispute,
          settlementResolution: outcome,
          disputeCorrect: disputeCorrectness(outcome, null),
          settled: true,
        },
        voteDispute: prev.voteDispute && {
          ...prev.voteDispute,
          settlementResolution: outcome,
          disputeCorrect: disputeCorrectness(outcome, prev.voteDispute.challengedLLMResolution),
          settled: true,
        },
      };
    }

    return prev;
  });
}
