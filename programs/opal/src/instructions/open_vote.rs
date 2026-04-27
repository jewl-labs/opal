use crate::{
    constants::{ASSERTION_SEED, PROTOCOL_CONFIG_SEED, VOTE_ROUND_SEED},
    errors::OpalError,
    state::{AssertionAccount, AssertionState, ProtocolConfig, VoteResolutionRound},
    utils::checked_add_i64,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct OpenVote<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump,
        has_one = authority @ OpalError::Unauthorized,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [ASSERTION_SEED, assertion.id.as_ref()],
        bump = assertion.bump,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [VOTE_ROUND_SEED, assertion.key().as_ref()],
        bump = vote_resolution_round.bump,
        constraint = vote_resolution_round.assertion == assertion.key() @ OpalError::AssertionLinkMismatch,
    )]
    pub vote_resolution_round: Account<'info, VoteResolutionRound>,
}

pub fn handler(ctx: Context<OpenVote>) -> Result<()> {
    require!(
        ctx.accounts.assertion.state == AssertionState::PendingVote,
        OpalError::InvalidState
    );

    let now = Clock::get()?.unix_timestamp;
    let voting_starts_at = checked_add_i64(now, ctx.accounts.protocol_config.vote_setup_window_seconds)?;
    let voting_deadline =
        checked_add_i64(voting_starts_at, ctx.accounts.protocol_config.voting_window_seconds)?;

    let vote_round = &mut ctx.accounts.vote_resolution_round;
    vote_round.voting_starts_at = Some(voting_starts_at);
    vote_round.voting_deadline = Some(voting_deadline);
    vote_round.reveal_deadline = Some(voting_deadline);
    vote_round.delegated = true;

    ctx.accounts.assertion.state = AssertionState::Voting;

    Ok(())
}
