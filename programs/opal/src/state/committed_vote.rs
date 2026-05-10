use anchor_lang::prelude::*;

/// Per-voter commit-reveal record for a single vote round.
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct CommittedVote {
    /// The vote round this commitment belongs to.
    pub vote_round: Pubkey,
    /// The voter's wallet address.
    pub voter: Pubkey,
    /// sha256(outcome_byte || salt_32_bytes || voter_pubkey_bytes)
    pub commitment: [u8; 32],
    /// OUTCOME_NONE until revealed; set to the voter's outcome on reveal.
    pub revealed_outcome: u8,
    /// PUSD bond locked at cast time, also used as the vote weight.
    pub weight: u64,
    /// BOOL_TRUE once the voter has claimed their reward.
    pub claimed: u8,
    pub created_at: i64,
    pub bump: u8,
}
