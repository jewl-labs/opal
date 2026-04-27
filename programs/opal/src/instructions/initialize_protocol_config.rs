use crate::{
    constants::{BPS_DENOMINATOR, PROTOCOL_CONFIG_SEED},
    errors::OpalError,
    state::ProtocolConfig,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct InitializeProtocolConfigArgs {
    pub assertion_bond_min_pusd: u64,
    pub llm_dispute_bond_ratio_bps: u16,
    pub vote_dispute_bond_ratio_bps: u16,
    pub protocol_fee_bps: u16,
    pub llm_disputer_reward_share_bps: u16,
    pub vote_disputer_reward_share_bps: u16,
    pub voter_reward_share_bps: u16,
    pub treasury_share_bps: u16,
    pub supermajority_bps: u16,
    pub liveness_window_seconds: i64,
    pub llm_challenge_window_seconds: i64,
    pub vote_setup_window_seconds: i64,
    pub voting_window_seconds: i64,
}

#[derive(Accounts)]
pub struct InitializeProtocolConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [PROTOCOL_CONFIG_SEED],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    pub pusd_mint: Account<'info, Mint>,

    #[account(
        token::mint = pusd_mint,
    )]
    pub treasury_pusd: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeProtocolConfig>, args: InitializeProtocolConfigArgs) -> Result<()> {
    require!(
        args.assertion_bond_min_pusd > 0,
        OpalError::InvalidAssertionBondMinimum
    );
    require!(
        u64::from(args.llm_dispute_bond_ratio_bps) <= BPS_DENOMINATOR,
        OpalError::ConfigInvariantViolation
    );
    require!(
        u64::from(args.vote_dispute_bond_ratio_bps) <= BPS_DENOMINATOR,
        OpalError::ConfigInvariantViolation
    );
    require!(
        u64::from(args.protocol_fee_bps) <= BPS_DENOMINATOR,
        OpalError::ConfigInvariantViolation
    );
    require!(
        u64::from(args.supermajority_bps) <= BPS_DENOMINATOR && args.supermajority_bps > 0,
        OpalError::ConfigInvariantViolation
    );
    require!(
        args.liveness_window_seconds > 0
            && args.llm_challenge_window_seconds > 0
            && args.vote_setup_window_seconds >= 0
            && args.voting_window_seconds > 0,
        OpalError::InvalidWindowConfiguration
    );

    let total_shares = u64::from(args.llm_disputer_reward_share_bps)
        .checked_add(u64::from(args.vote_disputer_reward_share_bps))
        .ok_or(OpalError::MathOverflow)?
        .checked_add(u64::from(args.voter_reward_share_bps))
        .ok_or(OpalError::MathOverflow)?
        .checked_add(u64::from(args.treasury_share_bps))
        .ok_or(OpalError::MathOverflow)?;

    require!(
        total_shares <= BPS_DENOMINATOR,
        OpalError::ConfigInvariantViolation
    );

    ctx.accounts.protocol_config.set_inner(ProtocolConfig {
        authority: ctx.accounts.authority.key(),
        pusd_mint: ctx.accounts.pusd_mint.key(),
        treasury: ctx.accounts.treasury_pusd.key(),
        assertion_bond_min_pusd: args.assertion_bond_min_pusd,
        llm_dispute_bond_ratio_bps: args.llm_dispute_bond_ratio_bps,
        vote_dispute_bond_ratio_bps: args.vote_dispute_bond_ratio_bps,
        protocol_fee_bps: args.protocol_fee_bps,
        llm_disputer_reward_share_bps: args.llm_disputer_reward_share_bps,
        vote_disputer_reward_share_bps: args.vote_disputer_reward_share_bps,
        voter_reward_share_bps: args.voter_reward_share_bps,
        treasury_share_bps: args.treasury_share_bps,
        supermajority_bps: args.supermajority_bps,
        liveness_window_seconds: args.liveness_window_seconds,
        llm_challenge_window_seconds: args.llm_challenge_window_seconds,
        vote_setup_window_seconds: args.vote_setup_window_seconds,
        voting_window_seconds: args.voting_window_seconds,
        bump: ctx.bumps.protocol_config,
    });

    Ok(())
}
