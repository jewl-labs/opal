use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    pub authority: Pubkey,
    pub oracle_authority: Pubkey,
    pub treasury: Pubkey,

    pub assertion_bond_min_pusd: u64,
    pub llm_dispute_bond_ratio: u16,
    pub vote_dispute_bond_ratio: u16,

    pub protocol_fee_bps: u16,
    pub llm_disputer_reward_share_bps: u16,
    pub vote_disputer_reward_share_bps: u16,
    pub voter_reward_share_bps: u16,
    pub treasury_share_bps: u16,
    pub incorrect_vote_slash_bps: u16,
    pub supermajority_bps: u16,

    pub liveness_window_seconds: i64,
    pub llm_challenge_window_seconds: i64,
    pub vote_setup_window_seconds: i64,
    pub voting_window_seconds: i64,
    pub reveal_window_seconds: i64,

    pub switchboard_program: Pubkey,
    pub switchboard_queue: Pubkey,
    pub switchboard_feed: Pubkey,
    pub switchboard_feed_hash: [u8; 32],
    pub max_staleness_slots: u64,

    pub pusd_mint: Pubkey,
    pub opal_mint: Pubkey,

    pub bump: u8,
}

impl ProtocolConfig {
    pub fn validate_bps(&self) -> bool {
        let reward_total = (self.llm_disputer_reward_share_bps as u32)
            .saturating_add(self.treasury_share_bps as u32);
        let vote_reward_total = (self.vote_disputer_reward_share_bps as u32)
            .saturating_add(self.voter_reward_share_bps as u32)
            .saturating_add(self.treasury_share_bps as u32);
        self.protocol_fee_bps <= 10_000
            && self.supermajority_bps <= 10_000
            && self.incorrect_vote_slash_bps <= 10_000
            && reward_total <= 10_000
            && vote_reward_total <= 10_000
    }

    pub fn required_llm_dispute_bond(&self, assertion_bond: u64) -> Option<u64> {
        (assertion_bond as u128)
            .checked_mul(self.llm_dispute_bond_ratio as u128)?
            .checked_div(10_000)?
            .try_into()
            .ok()
    }

    pub fn required_vote_dispute_bond(&self, assertion_bond: u64) -> Option<u64> {
        (assertion_bond as u128)
            .checked_mul(self.vote_dispute_bond_ratio as u128)?
            .checked_div(10_000)?
            .try_into()
            .ok()
    }
}
