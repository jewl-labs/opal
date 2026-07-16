use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_ASSERTED_LLM, ASSERTION_STATE_PENDING_LLM, LLM_ROUND_SEED,
        OUTCOME_TOO_EARLY, PROTOCOL_CONFIG_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, LlmResolutionRound, ProtocolConfig},
    utils::{checked_add_i64, validate_outcome_code},
};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SubmitLlmResolutionArgs {
    pub assertion_id: Pubkey,
    pub outcome_code: u8,
}

#[derive(Accounts)]
#[instruction(args: SubmitLlmResolutionArgs)]
pub struct SubmitLlmResolution<'info> {
    pub resolver: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [ASSERTION_SEED, args.assertion_id.as_ref()],
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

// Gated on `protocol_config.resolver` rather than `authority` so a leaked hot
// resolver key can only post a challengeable verdict, not act as governance
// (see docs/adr/0002-trusted-llm-resolver.md).
pub fn handler(ctx: Context<SubmitLlmResolution>, args: SubmitLlmResolutionArgs) -> Result<()> {
    let protocol_config = ctx.accounts.protocol_config.load()?;
    require!(
        ctx.accounts.resolver.key() == protocol_config.resolver,
        OpalError::Unauthorized
    );

    let assertion = &mut ctx.accounts.assertion.load_mut()?;
    require!(
        assertion.state == ASSERTION_STATE_PENDING_LLM,
        OpalError::InvalidState
    );

    let outcome = validate_outcome_code(args.outcome_code)?;
    // TooEarly is merged into Unresolvable per ADR-0005; the resolver emits
    // only True, False, or Unresolvable.
    require!(outcome != OUTCOME_TOO_EARLY, OpalError::InvalidOutcomeCode);

    let now = Clock::get()?.unix_timestamp;
    let challenge_deadline = checked_add_i64(now, protocol_config.llm_challenge_window_seconds)?;
    drop(protocol_config);

    let llm_round = &mut ctx.accounts.llm_resolution_round.load_mut()?;
    llm_round.outcome = outcome;
    llm_round.resolved_at = now;
    llm_round.challenge_deadline = challenge_deadline;

    assertion.state = ASSERTION_STATE_ASSERTED_LLM;
    assertion.llm_challenge_deadline = challenge_deadline;

    Ok(())
}
