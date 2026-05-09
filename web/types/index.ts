export type AssertionState =
  | 'Asserted' // default True, disputable
  | 'PendingLLM' // first dispute filed, awaiting Switchboard
  | 'AssertedLLM' // LLM result posted, challengeable
  | 'PendingVote' // LLM challenged, vote round initializing
  | 'Voting' // MagicBlock private voting active
  | 'Resolved'; // terminal, outcome set

export type ResolutionOutcome = 'True' | 'False' | 'TooEarly' | 'Unresolvable';

export interface LLMResolutionRound {
  pubkey: string;
  outcomeCode: 0 | 1 | 2 | 3; // 0=True 1=False 2=TooEarly 3=Unresolvable
  outcome: ResolutionOutcome | null;
  promptHash: string;
  resolvedAt: string | null;
  challengeDeadline: string | null;
}

export interface VoteResolutionRound {
  pubkey: string;
  votingStartsAt: string | null;
  votingDeadline: string | null;
  totalValidWeight: bigint;
  // !TBD: Align aggregateVotes value type with totalValidWeight (bigint vs number)
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
  auxiliaryHash: string; // SHA-256 of offchain aux text
  auxiliaryUrl?: string; // offchain URL for display
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
