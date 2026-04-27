use crate::{
    constants::{ASSERTION_SEED, LLM_ROUND_SEED, PROTOCOL_CONFIG_SEED},
    errors::OpalError,
    state::{AssertionAccount, AssertionState, LlmResolutionRound, ProtocolConfig},
    utils::{checked_add_i64, map_outcome_code},
};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SubmitMockLlmResolutionArgs {
    pub outcome_code: u8,
}

#[derive(Accounts)]
pub struct SubmitMockLlmResolution<'info> {
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
        seeds = [LLM_ROUND_SEED, assertion.key().as_ref()],
        bump = llm_resolution_round.bump,
        constraint = llm_resolution_round.assertion == assertion.key() @ OpalError::AssertionLinkMismatch,
    )]
    pub llm_resolution_round: Account<'info, LlmResolutionRound>,
}

pub fn handler(
    ctx: Context<SubmitMockLlmResolution>,
    args: SubmitMockLlmResolutionArgs,
) -> Result<()> {
    require!(
        ctx.accounts.assertion.state == AssertionState::PendingLlm,
        OpalError::InvalidState
    );

    let outcome = map_outcome_code(args.outcome_code)?;
    let now = Clock::get()?.unix_timestamp;
    let challenge_deadline = checked_add_i64(now, ctx.accounts.protocol_config.llm_challenge_window_seconds)?;

    let llm_round = &mut ctx.accounts.llm_resolution_round;
    llm_round.outcome_code = Some(args.outcome_code);
    llm_round.outcome = Some(outcome);
    llm_round.resolved_at = Some(now);
    llm_round.challenge_deadline = Some(challenge_deadline);

    let assertion = &mut ctx.accounts.assertion;
    assertion.state = AssertionState::AssertedLlm;
    assertion.llm_challenge_deadline = Some(challenge_deadline);

    Ok(())
}
