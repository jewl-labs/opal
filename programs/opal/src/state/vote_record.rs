use anchor_lang::prelude::*;

#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct VoteRecord {
    pub voter: Pubkey,
    pub vote_round: Pubkey,
    /// SHA-256(outcome_byte || nonce)
    pub commit_hash: [u8; 32],
    /// OPAL token balance snapshotted at commit time
    pub opal_weight: u64,
    pub committed_at: i64,
    /// Revealed outcome byte (valid after revealed == BOOL_TRUE)
    pub outcome: u8,
    pub revealed: u8,
    pub reward_claimed: u8,
    pub bump: u8,
    /// Nonce revealed during reveal_vote (stored for auditability)
    pub nonce: [u8; 32],
}
