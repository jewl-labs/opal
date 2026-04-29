use anchor_lang::prelude::*;

#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct VoteDisputeAccount {
    pub assertion: Pubkey,
    pub disputer: Pubkey,
    pub challenged_llm_resolution_round: Pubkey,
    pub challenged_llm_resolution: u8,
    pub bond_amount_pusd: u64,
    pub created_at: i64,
    pub resolution_round: Pubkey,
    pub settlement_resolution: u8,
    pub bump: u8,
}
