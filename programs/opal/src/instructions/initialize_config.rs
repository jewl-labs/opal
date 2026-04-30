use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use crate::errors::OpalError;
use crate::state::ProtocolConfig;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeConfigArgs {
    pub oracle_authority: Pubkey,
    
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
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub pusd_mint: Account<'info, Mint>,
    pub opal_mint: Account<'info, Mint>,

    /// CHECK: validated by the caller; must be a PUSD token account.
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeConfig<'info> {
    pub fn initialize_config(&mut self, args: InitializeConfigArgs, bump: u8) -> Result<()> {
        let cfg = &mut self.config;

        cfg.authority = self.authority.key();
        cfg.oracle_authority = args.oracle_authority;
        cfg.treasury = self.treasury.key();
        cfg.assertion_bond_min_pusd = args.assertion_bond_min_pusd;
        cfg.llm_dispute_bond_ratio = args.llm_dispute_bond_ratio;
        cfg.vote_dispute_bond_ratio = args.vote_dispute_bond_ratio;
        cfg.protocol_fee_bps = args.protocol_fee_bps;
        cfg.llm_disputer_reward_share_bps = args.llm_disputer_reward_share_bps;
        cfg.vote_disputer_reward_share_bps = args.vote_disputer_reward_share_bps;
        cfg.voter_reward_share_bps = args.voter_reward_share_bps;
        cfg.treasury_share_bps = args.treasury_share_bps;
        cfg.incorrect_vote_slash_bps = args.incorrect_vote_slash_bps;
        cfg.supermajority_bps = args.supermajority_bps;
        cfg.liveness_window_seconds = args.liveness_window_seconds;
        cfg.llm_challenge_window_seconds = args.llm_challenge_window_seconds;
        cfg.vote_setup_window_seconds = args.vote_setup_window_seconds;
        cfg.voting_window_seconds = args.voting_window_seconds;
        cfg.reveal_window_seconds = args.reveal_window_seconds;
        cfg.switchboard_program = args.switchboard_program;
        cfg.switchboard_queue = args.switchboard_queue;
        cfg.switchboard_feed = args.switchboard_feed;
        cfg.switchboard_feed_hash = args.switchboard_feed_hash;
        cfg.max_staleness_slots = args.max_staleness_slots;
        cfg.pusd_mint = self.pusd_mint.key();
        cfg.opal_mint = self.opal_mint.key();
        cfg.bump = bump;

        require!(cfg.validate_bps(), OpalError::InvalidConfig);

        Ok(())
    }

    pub fn update_config(&mut self, args: InitializeConfigArgs) -> Result<()> {
        require_keys_eq!(
            self.authority.key(),
            self.config.authority,
            OpalError::Unauthorized
        );

        let cfg = &mut self.config;
        cfg.oracle_authority = args.oracle_authority;
        cfg.assertion_bond_min_pusd = args.assertion_bond_min_pusd;
        cfg.llm_dispute_bond_ratio = args.llm_dispute_bond_ratio;
        cfg.vote_dispute_bond_ratio = args.vote_dispute_bond_ratio;
        cfg.protocol_fee_bps = args.protocol_fee_bps;
        cfg.llm_disputer_reward_share_bps = args.llm_disputer_reward_share_bps;
        cfg.vote_disputer_reward_share_bps = args.vote_disputer_reward_share_bps;
        cfg.voter_reward_share_bps = args.voter_reward_share_bps;
        cfg.treasury_share_bps = args.treasury_share_bps;
        cfg.incorrect_vote_slash_bps = args.incorrect_vote_slash_bps;
        cfg.supermajority_bps = args.supermajority_bps;
        cfg.liveness_window_seconds = args.liveness_window_seconds;
        cfg.llm_challenge_window_seconds = args.llm_challenge_window_seconds;
        cfg.vote_setup_window_seconds = args.vote_setup_window_seconds;
        cfg.voting_window_seconds = args.voting_window_seconds;
        cfg.reveal_window_seconds = args.reveal_window_seconds;
        cfg.switchboard_program = args.switchboard_program;
        cfg.switchboard_queue = args.switchboard_queue;
        cfg.switchboard_feed = args.switchboard_feed;
        cfg.switchboard_feed_hash = args.switchboard_feed_hash;
        cfg.max_staleness_slots = args.max_staleness_slots;

        require!(cfg.validate_bps(), OpalError::InvalidConfig);

        Ok(())
    }
}
