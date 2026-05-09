use crate::constants::{MAX_AUXILIARY_HASH_LEN, MAX_STATEMENT_LEN};
use anchor_lang::prelude::*;

/// Onchain record of a single assertion, its lifecycle state, bonds, and resolution links.
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
    pub assertion_bond_amount_pusd: u64,
    pub llm_dispute: Pubkey,
    pub vote_dispute: Pubkey,
    pub llm_resolution_round: Pubkey,
    pub vote_resolution_round: Pubkey,
    pub bump: u8,
}

impl AssertionAccount {
    pub fn statement_str(&self) -> String {
        let end = self
            .statement
            .iter()
            .position(|&b| b == 0)
            .unwrap_or(MAX_STATEMENT_LEN);
        String::from_utf8_lossy(&self.statement[..end]).to_string()
    }

    pub fn auxiliary_hash_str(&self) -> String {
        let end = self
            .auxiliary_hash
            .iter()
            .position(|&b| b == 0)
            .unwrap_or(MAX_AUXILIARY_HASH_LEN);
        String::from_utf8_lossy(&self.auxiliary_hash[..end]).to_string()
    }
}
