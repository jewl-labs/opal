use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    pub authority: Pubkey,
    /// For MVP: trusted key that posts LLM outcomes.
    /// Replace with Switchboard QuoteVerifier in production.
    pub oracle_authority: Pubkey,
    pub assertion_bond_min: u64,
    pub liveness_window_secs: i64,
    pub llm_challenge_window_secs: i64,
    pub switchboard_queue: Pubkey,
    pub max_staleness_slots: u64,
    pub pusd_mint: Pubkey,
    pub treasury: Pubkey,
    pub protocol_fee_bps: u16,
    pub bump: u8,
}
