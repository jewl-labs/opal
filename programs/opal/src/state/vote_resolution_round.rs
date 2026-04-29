use anchor_lang::prelude::*;

#[repr(C, packed)]
#[zero_copy(unsafe)]
#[derive(Default)]
pub struct VotesPerOutcome {
    pub true_weight: u128,
    pub false_weight: u128,
    pub too_early_weight: u128,
    pub unresolvable_weight: u128,
}

#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct VoteResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    pub magicblock_validator: Pubkey,
    pub permission_account: Pubkey,
    pub delegated_vote_state: Pubkey,
    pub delegated: u8,
    pub committed: u8,
    pub voting_starts_at: i64,
    pub voting_deadline: i64,
    pub reveal_deadline: i64,
    pub total_valid_weight: u128,
    pub aggregate_votes: VotesPerOutcome,
    pub final_outcome: u8,
    pub bump: u8,
}
