export type AssertionState =
  | 'Asserted' // default True, disputable
  | 'PendingLLM' // first dispute filed, awaiting the trusted LLM resolver
  | 'AssertedLLM' // LLM result posted, challengeable
  | 'PendingVote' // LLM challenged, vote round initializing
  | 'Voting' // MagicBlock private voting active
  | 'Resolved'; // terminal, outcome set

// Unresolvable also covers "too early" — the legacy TooEarly outcome (code 2) is
// merged into it and no path emits it.
export type ResolutionOutcome = 'True' | 'False' | 'Unresolvable';

export interface LLMResolutionRound {
  pubkey: string;
  outcomeCode: 0 | 1 | 3; // 0=True 1=False 3=Unresolvable (2 reserved — legacy TooEarly)
  outcome: ResolutionOutcome | null;
  resolvedAt: string | null;
  challengeDeadline: string | null;
}

export interface VoteResolutionRound {
  pubkey: string;
  votingStartsAt: string | null;
  votingDeadline: string | null;
  totalValidWeight: bigint;
  aggregateVotes: Record<ResolutionOutcome, number>;
  finalOutcome: ResolutionOutcome | null;
}

export interface LLMDisputeAccount {
  pubkey: string;
  disputer: string;
  bondAmountPUSD: number;
  createdAt: string;
  settlementResolution: ResolutionOutcome | null;
  disputeCorrect: boolean | null;
  settled: boolean;
}

export interface VoteDisputeAccount {
  pubkey: string;
  disputer: string;
  challengedLLMResolution: ResolutionOutcome | null;
  bondAmountPUSD: number;
  createdAt: string;
  settlementResolution: ResolutionOutcome | null;
  disputeCorrect: boolean | null;
  settled: boolean;
}

export interface AssertionAccount {
  id: string; // PDA pubkey
  asserter: string; // wallet pubkey
  statement: string;
  auxiliaryHash: string; // SHA-256 of the offchain Resolution Spec (field name mirrors the program)
  auxiliaryUrl?: string; // offchain URL of the Resolution Spec for display
  bondAmountPUSD: number;
  state: AssertionState;
  livenessDeadline: string;
  outcome: ResolutionOutcome | null;
  finalizedAt: string | null;
  disputeCount: 0 | 1 | 2;
  llmDispute: LLMDisputeAccount | null;
  voteDispute: VoteDisputeAccount | null;
  llmResolutionRound: LLMResolutionRound | null;
  voteResolutionRound: VoteResolutionRound | null;
  createdAt: string;
}
