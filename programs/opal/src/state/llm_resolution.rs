use anchor_lang::prelude::*;

use crate::state::ResolutionOutcome;

#[account]
#[derive(InitSpace)]
pub struct LLMResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    /// Switchboard queue that must sign the oracle quote.
    pub switchboard_queue: Pubkey,
    /// Feed hash committed at dispute time; verified against the quote on submission.
    pub switchboard_feed_hash: [u8; 32],
    pub max_staleness_slots: u64,
    /// SHA-256 of the full prompt sent to the LLM; stored for auditability and vote challenges.
    pub prompt_hash: [u8; 32],
    pub outcome_code: Option<u8>,
    pub outcome: Option<ResolutionOutcome>,
    pub requested_at: i64,
    pub resolved_at: Option<i64>,
    /// Opens after outcome is posted; second dispute must arrive before this.
    pub challenge_deadline: Option<i64>,
    pub settled: bool,
    pub bump: u8,
}
