use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_ASSERTED_LLM, ASSERTION_STATE_PENDING_LLM, LLM_ROUND_SEED,
        OUTCOME_NONE, OUTCOME_UNRESOLVABLE, PROTOCOL_CONFIG_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, LlmResolutionRound, ProtocolConfig},
    utils::checked_add_i64,
};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RecoverPendingLlmArgs {
    pub assertion_id: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: RecoverPendingLlmArgs)]
pub struct RecoverPendingLlm<'info> {
    pub finalizer: Signer<'info>,

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

pub fn handler(ctx: Context<RecoverPendingLlm>, _args: RecoverPendingLlmArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let config = ctx.accounts.protocol_config.load()?;
    let assertion = ctx.accounts.assertion.load()?;
    let llm_round = ctx.accounts.llm_resolution_round.load()?;

    require!(
        assertion.state == ASSERTION_STATE_PENDING_LLM,
        OpalError::InvalidState
    );
    require!(
        llm_round.assertion == ctx.accounts.assertion.key(),
        OpalError::AssertionLinkMismatch
    );
    require!(
        llm_round.dispute == assertion.llm_dispute,
        OpalError::RoundLinkMismatch
    );
    require!(
        assertion.llm_resolution_round == ctx.accounts.llm_resolution_round.key(),
        OpalError::RoundLinkMismatch
    );
    require!(llm_round.outcome == OUTCOME_NONE, OpalError::AlreadySettled);

    let recovery_deadline = checked_add_i64(
        llm_round.requested_at,
        config.llm_resolution_timeout_seconds,
    )?;
    require!(now >= recovery_deadline, OpalError::DeadlineNotReached);
    let challenge_deadline = checked_add_i64(now, config.llm_challenge_window_seconds)?;

    drop(config);
    drop(assertion);
    drop(llm_round);

    let mut llm_round = ctx.accounts.llm_resolution_round.load_mut()?;
    llm_round.outcome = OUTCOME_UNRESOLVABLE;
    llm_round.resolved_at = now;
    llm_round.challenge_deadline = challenge_deadline;

    let mut assertion = ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_ASSERTED_LLM;
    assertion.llm_challenge_deadline = challenge_deadline;

    Ok(())
}
