use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_ASSERTED_LLM, ASSERTION_STATE_PENDING_LLM, LLM_ROUND_SEED,
        PROTOCOL_CONFIG_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, LlmResolutionRound, ProtocolConfig},
    utils::{checked_add_i64, validate_outcome_code},
};
use anchor_lang::prelude::*;
use switchboard_on_demand::QuoteVerifier;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SubmitLlmResolutionArgs {
    /// SHA-256 of the full prompt sent to the LLM; stored onchain for auditability.
    pub prompt_hash: [u8; 32],
}

/// Submits a verified Switchboard oracle quote carrying the LLM resolution outcome.
///
/// Transaction layout the client must build:
///   ix[0]  — sigVerifyIx from queue.fetchQuoteIx(crossbar, [feedHash])
///   ix[1]  — this instruction (submit_llm_resolution)
///
/// QuoteVerifier reads ix[0] from the instructions sysvar, verifies the oracle
/// secp256k1 signatures against the queue, checks staleness, and returns the
/// OracleQuote with feed values.
#[derive(Accounts)]
pub struct SubmitLlmResolution<'info> {
    pub submitter: Signer<'info>,

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

    /// CHECK: Key verified in handler against LlmResolutionRound.switchboard_queue.
    pub switchboard_queue: AccountInfo<'info>,

    /// CHECK: Instructions sysvar — QuoteVerifier reads the secp256k1 verify
    /// instruction prepended by the client to extract and authenticate oracle data.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,
}

pub fn handler(
    ctx: Context<SubmitLlmResolution>,
    args: SubmitLlmResolutionArgs,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    // 1. Validate assertion state
    let assertion = ctx.accounts.assertion.load()?;
    require!(
        assertion.state == ASSERTION_STATE_PENDING_LLM,
        OpalError::InvalidState
    );
    drop(assertion);

    // 2. Copy fields needed from round (drop before mutable borrow later)
    let llm_round = ctx.accounts.llm_resolution_round.load()?;
    let stored_queue = llm_round.switchboard_queue;
    let max_staleness = llm_round.max_staleness_slots;
    let stored_feed_hash = llm_round.switchboard_feed_hash;
    drop(llm_round);

    // 3. Verify queue account matches what was committed at dispute time
    require!(
        ctx.accounts.switchboard_queue.key() == stored_queue,
        OpalError::InvalidFeed
    );

    // 4. Verify Switchboard oracle quote via instruction introspection
    // The client must prepend a sigVerifyIx (queue.fetchQuoteIx via Crossbar)
    // as instruction 0 in the same transaction before this instruction.
    let quote = QuoteVerifier::new()
        .queue(&ctx.accounts.switchboard_queue)
        .max_age(max_staleness)
        .verify_instruction_at(0)
        .map_err(|_| error!(OpalError::InvalidQuote))?;

    // 5. Verify feed hash matches what was committed at dispute time
    let feeds = quote.feeds();
    require!(!feeds.is_empty(), OpalError::NoFeedData);
    let feed = &feeds[0];

    // PackedFeedInfo exposes the hash via hex_id(); encode stored bytes to compare.
    let expected_hex: String = stored_feed_hash
        .iter()
        .fold(String::with_capacity(64), |mut s, b| {
            s.push_str(&format!("{:02x}", b));
            s
        });
    require!(feed.hex_id() == expected_hex, OpalError::InvalidFeed);

    // 6. Map feed value → outcome code (exact integer, no decimal scaling)
    let raw = feed.value();
    let outcome_code =
        u8::try_from(raw).map_err(|_| error!(OpalError::InvalidOutcomeCode))?;
    let outcome = validate_outcome_code(outcome_code)?;

    // 7. Compute challenge deadline
    let protocol_config = ctx.accounts.protocol_config.load()?;
    let challenge_deadline =
        checked_add_i64(now, protocol_config.llm_challenge_window_seconds)?;
    drop(protocol_config);

    // 8. Write results
    let llm_round = &mut ctx.accounts.llm_resolution_round.load_mut()?;
    llm_round.outcome = outcome;
    llm_round.resolved_at = now;
    llm_round.challenge_deadline = challenge_deadline;
    llm_round.prompt_hash = args.prompt_hash;

    let assertion = &mut ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_ASSERTED_LLM;
    assertion.llm_challenge_deadline = challenge_deadline;

    Ok(())
}
