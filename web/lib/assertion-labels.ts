import type { AssertionAccount, AssertionState, ResolutionOutcome } from '@/types';

export function getStageLabel(state: AssertionState): string {
  const stageMap: Record<AssertionState, string> = {
    Asserted: 'Asserted',
    PendingLLM: 'Awaiting LLM',
    AssertedLLM: 'LLM Resolved',
    PendingVote: 'Preparing Vote',
    Voting: 'Voting',
    Resolved: 'Finalized',
  };
  return stageMap[state];
}

export function getOutcomeLabel(outcome: ResolutionOutcome | null): string {
  if (!outcome) return '—';
  const outcomeMap: Record<ResolutionOutcome, string> = {
    True: 'True',
    False: 'False',
    Unresolvable: 'Unresolvable',
  };
  return outcomeMap[outcome];
}

export function getFinalizationStatus(
  assertion: AssertionAccount
): 'optimistic' | 'pending' | 'finalized' {
  if (assertion.finalizedAt) {
    return 'finalized';
  }

  if (assertion.state === 'Voting' || assertion.state === 'PendingVote' || assertion.voteDispute) {
    return 'pending';
  }

  if (assertion.state === 'PendingLLM' || assertion.llmDispute) {
    return 'pending';
  }

  return 'optimistic';
}

export function getContextualMessage(assertion: AssertionAccount): string {
  const { state, llmDispute, voteDispute, llmResolutionRound, voteResolutionRound, outcome } =
    assertion;

  if (assertion.finalizedAt) {
    const method =
      voteResolutionRound && voteResolutionRound.finalOutcome
        ? 'voting'
        : llmResolutionRound && llmResolutionRound.outcome
          ? 'llm'
          : 'optimistic';
    return `Finalized via ${method}`;
  }

  if (state === 'Voting' || voteResolutionRound?.votingStartsAt) {
    return 'Staked vote live';
  }

  if (voteDispute) {
    return 'LLM resolution challenged';
  }

  if (state === 'PendingVote' || state === 'AssertedLLM') {
    return llmResolutionRound
      ? `${getOutcomeLabel(llmResolutionRound.outcome)} (awaiting challenge)`
      : 'Awaiting LLM resolution';
  }

  if (state === 'PendingLLM' || llmDispute) {
    return 'Disputed → awaiting LLM';
  }

  if (state === 'Asserted') {
    return outcome ? `${getOutcomeLabel(outcome)} (optimistic)` : 'Asserted (default true)';
  }

  return state;
}

export function getDisputeLevel(assertion: AssertionAccount): 'none' | 'llm' | 'vote' {
  if (assertion.voteDispute) {
    return 'vote';
  }
  if (assertion.llmDispute) {
    return 'llm';
  }
  return 'none';
}
