use crate::state::ResolutionOutcome;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct LlmDisputeAccount {
    pub assertion: Pubkey,
    pub disputer: Pubkey,
    pub bond_amount_pusd: u64,
    pub created_at: i64,
    pub resolution_round: Pubkey,
    pub settlement_resolution: Option<ResolutionOutcome>,
    pub bump: u8,
}
