use crate::state::ResolutionOutcome;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct LlmResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    pub switchboard_program: Pubkey,
    pub switchboard_queue: Pubkey,
    pub switchboard_feed: Pubkey,
    pub switchboard_feed_hash: [u8; 32],
    pub switchboard_quote: Option<Pubkey>,
    pub switchboard_quote_slot: Option<u64>,
    pub max_staleness_slots: u64,
    pub prompt_hash: [u8; 32],
    pub variable_overrides_hash: Option<[u8; 32]>,
    pub response_hash: Option<[u8; 32]>,
    pub evidence_hash: Option<[u8; 32]>,
    pub outcome_code: Option<u8>,
    pub outcome: Option<ResolutionOutcome>,
    pub requested_at: i64,
    pub resolved_at: Option<i64>,
    pub challenge_deadline: Option<i64>,
    pub bump: u8,
}
