use crate::{
    constants::{MAX_AUXILIARY_HASH_LEN, MAX_STATEMENT_LEN},
    state::{AssertionState, ResolutionOutcome},
};
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AssertionAccount {
    pub id: Pubkey,
    pub asserter: Pubkey,
    #[max_len(MAX_STATEMENT_LEN)]
    pub statement: String,
    #[max_len(MAX_AUXILIARY_HASH_LEN)]
    pub auxiliary_hash: String,
    pub bond_vault: Pubkey,
    pub state: AssertionState,
    pub liveness_deadline: i64,
    pub llm_challenge_deadline: Option<i64>,
    pub outcome: Option<ResolutionOutcome>,
    pub finalized_at: Option<i64>,
    pub dispute_count: u8,
    pub assertion_bond_amount_pusd: u64,
    pub llm_dispute: Option<Pubkey>,
    pub vote_dispute: Option<Pubkey>,
    pub llm_resolution_round: Option<Pubkey>,
    pub vote_resolution_round: Option<Pubkey>,
    pub bump: u8,
}
