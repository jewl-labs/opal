use anchor_lang::prelude::*;

#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct LlmResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    pub outcome: u8,
    pub requested_at: i64,
    pub resolved_at: i64,
    pub challenge_deadline: i64,
    pub bump: u8,
}
