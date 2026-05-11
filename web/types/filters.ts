export type StageFilter =
  | 'All'
  | 'Optimistic'
  | 'AwaitingLLM'
  | 'LLMResolved'
  | 'Voting'
  | 'Finalized';

export type QuickFilter =
  | 'onlyDisputed'
  | 'highStakes'
  | 'myAssertions'
  | 'watching'
  | 'unresolved';

export type SortField =
  | 'newest'
  | 'oldest'
  | 'endingSoon'
  | 'highestBond'
  | 'mostDisputed'
  | 'recentlyResolved';
