use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum AssertionState {
    Asserted,
    PendingLlm,
    AssertedLlm,
    PendingVote,
    Voting,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum ResolutionOutcome {
    True,
    False,
    TooEarly,
    Unresolvable,
}
