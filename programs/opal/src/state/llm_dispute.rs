use anchor_lang::prelude::*;

use crate::state::ResolutionOutcome;

#[account]
#[derive(InitSpace)]
pub struct LLMDisputeAccount {
    pub assertion: Pubkey,
    pub disputer: Pubkey,
    pub bond_amount: u64,
    pub created_at: i64,
    pub resolution_round: Pubkey,
    /// Set at settlement time; mirrors LLMResolutionRound.outcome (or vote outcome if escalated).
    pub settlement_resolution: Option<ResolutionOutcome>,
    /// True when settlement_resolution != True (first dispute always challenges the default True).
    pub dispute_correct: Option<bool>,
    pub settled: bool,
    pub bump: u8,
}
