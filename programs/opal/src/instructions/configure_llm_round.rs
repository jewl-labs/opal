use crate::{
    constants::{ASSERTION_SEED, ASSERTION_STATE_PENDING_LLM, LLM_ROUND_SEED, PROTOCOL_CONFIG_SEED},
    errors::OpalError,
    state::{AssertionAccount, LlmResolutionRound, ProtocolConfig},
};
use anchor_lang::prelude::*;

/// Arguments for the `configure_llm_round` instruction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ConfigureLlmRoundArgs {
    /// Switchboard oracle queue that will serve this feed.
    pub switchboard_queue: Pubkey,
    /// SHA-256 of the Switchboard pull-feed job definition; used to verify the
    /// oracle quote at submit time.
    pub switchboard_feed_hash: [u8; 32],
    /// Maximum age of the oracle quote in slots before it is considered stale.
    pub max_staleness_slots: u64,
}

/// Accounts for the `configure_llm_round` instruction.
#[derive(Accounts)]
pub struct ConfigureLlmRound<'info> {
    /// Must be the protocol authority.
    pub authority: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,

    #[account(
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

/// Commits Switchboard oracle parameters to the LLM round so `submit_llm_resolution` can verify them.
pub fn handler(ctx: Context<ConfigureLlmRound>, args: ConfigureLlmRoundArgs) -> Result<()> {
    // 1. Require authority
    let config = ctx.accounts.protocol_config.load()?;
    require!(
        ctx.accounts.authority.key() == config.authority,
        OpalError::Unauthorized
    );
    drop(config);

    // 2. Require assertion is awaiting oracle
    let assertion = ctx.accounts.assertion.load()?;
    require!(
        assertion.state == ASSERTION_STATE_PENDING_LLM,
        OpalError::InvalidState
    );
    drop(assertion);

    // 3. Commit oracle parameters
    let round = &mut ctx.accounts.llm_resolution_round.load_mut()?;
    round.switchboard_queue = args.switchboard_queue;
    round.switchboard_feed_hash = args.switchboard_feed_hash;
    round.max_staleness_slots = args.max_staleness_slots;

    Ok(())
}
