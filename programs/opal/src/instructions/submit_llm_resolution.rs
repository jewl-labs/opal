use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_ASSERTED_LLM, ASSERTION_STATE_PENDING_LLM,
        COUNCIL_SIZE, LLM_ROUND_SEED, MAX_FEED_STALE_SLOTS, MIN_FEED_SAMPLES,
        OUTCOME_UNRESOLVABLE, PROTOCOL_CONFIG_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, LlmResolutionRound, ProtocolConfig},
    utils::checked_add_i64,
};
use anchor_lang::prelude::*;
use switchboard_on_demand::prelude::rust_decimal::prelude::ToPrimitive;
use switchboard_on_demand::PullFeedAccountData;

#[derive(Accounts)]
pub struct SubmitLlmResolution<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

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

    /// CHECK: pubkey verified against llm_resolution_round.council_feeds[0]
    pub feed_0: UncheckedAccount<'info>,
    /// CHECK: pubkey verified against llm_resolution_round.council_feeds[1]
    pub feed_1: UncheckedAccount<'info>,
    /// CHECK: pubkey verified against llm_resolution_round.council_feeds[2]
    pub feed_2: UncheckedAccount<'info>,
}

fn read_verdict(
    feed_info: &AccountInfo<'_>,
    expected_key: &Pubkey,
    clock: &Clock,
) -> Result<u8> {
    // Identity check before any data borrow — rejects substituted feed accounts early.
    require!(feed_info.key() == *expected_key, OpalError::WrongFeed);
    let data = feed_info.try_borrow_data()?;
    let feed = PullFeedAccountData::parse(data)
        .map_err(|_| error!(OpalError::FeedParseFailed))?;
    let value = feed
        .get_value(clock.slot, MAX_FEED_STALE_SLOTS as u64, MIN_FEED_SAMPLES, false)
        .map_err(|_| error!(OpalError::FeedStaleOrUnverified))?;
    require!(value.is_integer(), OpalError::InvalidVerdictEncoding);
    let verdict = value.to_u8().ok_or(OpalError::InvalidVerdictEncoding)?;
    require!(verdict <= OUTCOME_UNRESOLVABLE, OpalError::InvalidVerdictEncoding);
    Ok(verdict)
}

pub fn handler(ctx: Context<SubmitLlmResolution>) -> Result<()> {
    let assertion_state = ctx.accounts.assertion.load()?.state;
    require!(
        assertion_state == ASSERTION_STATE_PENDING_LLM,
        OpalError::InvalidState
    );

    let round = ctx.accounts.llm_resolution_round.load()?;
    let council_feeds = round.council_feeds;
    drop(round);

    let challenge_window = ctx.accounts.protocol_config.load()?.llm_challenge_window_seconds;
    let clock = Clock::get()?;

    let votes: [u8; COUNCIL_SIZE] = [
        read_verdict(ctx.accounts.feed_0.as_ref(), &council_feeds[0], &clock)?,
        read_verdict(ctx.accounts.feed_1.as_ref(), &council_feeds[1], &clock)?,
        read_verdict(ctx.accounts.feed_2.as_ref(), &council_feeds[2], &clock)?,
    ];

    let mut counts = [0u8; OUTCOME_UNRESOLVABLE as usize + 1];
    for v in votes.iter() {
        counts[*v as usize] += 1;
    }
    // 1-1-1 tie falls back to Unresolvable.
    let verdict = (0u8..=(OUTCOME_UNRESOLVABLE))
        .find(|&o| counts[o as usize] > (COUNCIL_SIZE as u8 / 2))
        .unwrap_or(OUTCOME_UNRESOLVABLE);

    let now = clock.unix_timestamp;
    let challenge_deadline = checked_add_i64(now, challenge_window)?;

    let mut round = ctx.accounts.llm_resolution_round.load_mut()?;
    round.outcome = verdict;
    round.resolved_at = now;
    round.challenge_deadline = challenge_deadline;
    drop(round);

    let mut assertion = ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_ASSERTED_LLM;
    assertion.llm_challenge_deadline = challenge_deadline;

    Ok(())
}
