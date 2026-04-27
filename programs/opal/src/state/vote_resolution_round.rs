use crate::state::ResolutionOutcome;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default, InitSpace)]
pub struct VotesPerOutcome {
    pub true_weight: u128,
    pub false_weight: u128,
    pub too_early_weight: u128,
    pub unresolvable_weight: u128,
}

#[account]
#[derive(InitSpace)]
pub struct VoteResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    pub magicblock_validator: Pubkey,
    pub permission_account: Option<Pubkey>,
    pub delegated_vote_state: Option<Pubkey>,
    pub delegated: bool,
    pub committed: bool,
    pub voting_starts_at: Option<i64>,
    pub voting_deadline: Option<i64>,
    pub reveal_deadline: Option<i64>,
    pub total_valid_weight: u128,
    pub aggregate_votes: VotesPerOutcome,
    pub final_outcome: Option<ResolutionOutcome>,
    pub bump: u8,
}
