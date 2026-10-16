use crate::constants::{MAX_AUXILIARY_HASH_LEN, MAX_STATEMENT_LEN};
use anchor_lang::prelude::*;

#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct AssertionAccount {
    pub id: Pubkey,
    pub asserter: Pubkey,
    pub statement: [u8; MAX_STATEMENT_LEN],
    pub auxiliary_hash: [u8; MAX_AUXILIARY_HASH_LEN],
    pub bond_vault: Pubkey,
    pub state: u8,
    pub liveness_deadline: i64,
    pub llm_challenge_deadline: i64,
    pub outcome: u8,
    pub finalized_at: i64,
    pub dispute_count: u8,
    pub assertion_bond_amount_usdc: u64,
    pub llm_dispute: Pubkey,
    pub vote_dispute: Pubkey,
    pub llm_resolution_round: Pubkey,
    pub bump: u8,
}
