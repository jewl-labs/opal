use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_ASSERTED_LLM, ASSERTION_STATE_PENDING_LLM, LLM_ROUND_SEED,
        PROTOCOL_CONFIG_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, LlmResolutionRound, ProtocolConfig},
    utils::{checked_add_i64, map_outcome_code},
};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SubmitMockLlmResolutionArgs {
    pub outcome_code: u8,
}

#[derive(Accounts)]
pub struct SubmitMockLlmResolution<'info> {
    #[account(
        constraint = authority.key() == protocol_config.load()?.authority
    )]
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
        seeds = [LLM_ROUND_SEED, assertion.key().as_ref()],
        bump = llm_resolution_round.load()?.bump,
    )]
    pub llm_resolution_round: AccountLoader<'info, LlmResolutionRound>,
}

// PLACEHOLDER: This is a mock instruction for local testing.
// In production, LLM resolution will be delivered by a Switchboard oracle callback
// that updates the LlmResolutionRound outcome fields on-chain.
pub fn handler(
    ctx: Context<SubmitMockLlmResolution>,
    args: SubmitMockLlmResolutionArgs,
) -> Result<()> {
    let assertion = ctx.accounts.assertion.load()?;
    require!(
        assertion.state == ASSERTION_STATE_PENDING_LLM,
        OpalError::InvalidState
    );
    drop(assertion);

    let protocol_config = ctx.accounts.protocol_config.load()?;
    let outcome = map_outcome_code(args.outcome_code)?;
    let now = Clock::get()?.unix_timestamp;
    let challenge_deadline = checked_add_i64(now, protocol_config.llm_challenge_window_seconds)?;
    drop(protocol_config);

    let llm_round = &mut ctx.accounts.llm_resolution_round.load_mut()?;
    llm_round.outcome_code = args.outcome_code;
    llm_round.outcome = outcome;
    llm_round.resolved_at = now;
    llm_round.challenge_deadline = challenge_deadline;

    let assertion = &mut ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_ASSERTED_LLM;
    assertion.llm_challenge_deadline = challenge_deadline;

    Ok(())
}
