// Test-only instruction: sets up voting windows without delegating to MagicBlock ER.
// Compiled only when the "test-mode" feature is active.
#![cfg(feature = "test-mode")]

use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_PENDING_VOTE, ASSERTION_STATE_VOTING, BOOL_TRUE,
        PROTOCOL_CONFIG_SEED, VOTE_ROUND_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, ProtocolConfig, VoteResolutionRound},
    utils::checked_add_i64,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct OpenVoteMock<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [ASSERTION_SEED, assertion.load()?.id.as_ref()],
        bump = assertion.load()?.bump,
    )]
    pub assertion: AccountLoader<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [VOTE_ROUND_SEED, assertion.key().as_ref()],
        bump = vote_resolution_round.load()?.bump,
    )]
    pub vote_resolution_round: AccountLoader<'info, VoteResolutionRound>,
}

pub fn handler(ctx: Context<OpenVoteMock>) -> Result<()> {
    let assertion = ctx.accounts.assertion.load()?;
    let vote_round = ctx.accounts.vote_resolution_round.load()?;
    require!(
        assertion.state == ASSERTION_STATE_PENDING_VOTE,
        OpalError::InvalidState
    );
    require!(
        vote_round.assertion == ctx.accounts.assertion.key(),
        OpalError::AssertionLinkMismatch
    );
    drop(assertion);
    drop(vote_round);

    let now = Clock::get()?.unix_timestamp;
    let protocol_config = ctx.accounts.protocol_config.load()?;
    // voting_starts_at = now so voters can cast immediately after this instruction.
    let voting_starts_at = now;
    let voting_deadline = checked_add_i64(now, protocol_config.voting_window_seconds)?;
    let reveal_deadline = checked_add_i64(voting_deadline, protocol_config.reveal_window_seconds)?;
    drop(protocol_config);

    let vote_round = &mut ctx.accounts.vote_resolution_round.load_mut()?;
    vote_round.voting_starts_at = voting_starts_at;
    vote_round.voting_deadline = voting_deadline;
    vote_round.reveal_deadline = reveal_deadline;
    // Mark delegated so cast_vote/reveal_vote validation passes.
    // Account is NOT actually delegated — tests run entirely on L1.
    vote_round.delegated = BOOL_TRUE;

    let assertion = &mut ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_VOTING;

    Ok(())
}
