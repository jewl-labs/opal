use anchor_lang::prelude::*;

/// Records a disputer's bond and links to the LLM resolution round for an assertion.
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct LlmDisputeAccount {
    pub assertion: Pubkey,
    pub disputer: Pubkey,
    pub bond_amount_pusd: u64,
    pub created_at: i64,
    pub resolution_round: Pubkey,
    pub settlement_resolution: u8,
    pub bump: u8,
}
