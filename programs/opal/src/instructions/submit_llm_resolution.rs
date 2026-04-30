use anchor_lang::prelude::*;
use crate::errors::OpalError;
use crate::state::{AssertionAccount, AssertionState, LLMResolutionRound, ProtocolConfig, ResolutionOutcome};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SubmitLLMResolutionArgs {
    pub outcome_code: u8,
    pub quote_slot: u64,
    pub response_hash: Option<[u8; 32]>,
    pub evidence_hash: Option<[u8; 32]>,
}

#[derive(Accounts)]
pub struct SubmitLLMResolution<'info> {
    /// V1: trusted oracle authority. V2: replace with SwitchboardQuoteExt verification.
    pub oracle_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"assertion", assertion.id.as_ref()],
        bump = assertion.bump,
        constraint = assertion.state == AssertionState::PendingLLM @ OpalError::InvalidState,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [b"llm_round", assertion.key().as_ref()],
        bump = llm_round.bump,
        constraint = llm_round.outcome.is_none() @ OpalError::ResolutionAlreadySubmitted,
    )]
    pub llm_round: Account<'info, LLMResolutionRound>,

    /// CHECK: manually verified against stored feed pubkey and owner.
    pub switchboard_feed: UncheckedAccount<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.oracle_authority == oracle_authority.key() @ OpalError::OracleAuthorityMismatch,
    )]
    pub config: Account<'info, ProtocolConfig>,
}

impl<'info> SubmitLLMResolution<'info> {
    pub fn submit_llm_resolution(&mut self, args: SubmitLLMResolutionArgs) -> Result<()> {
        let clock = Clock::get()?;

        require_keys_eq!(
            self.switchboard_feed.key(),
            self.llm_round.switchboard_feed,
            OpalError::FeedMismatch
        );

        require_keys_eq!(
            *self.switchboard_feed.owner,
            self.config.switchboard_program,
            OpalError::FeedMismatch
        );

        let staleness = clock.slot.saturating_sub(args.quote_slot);
        require!(staleness <= self.llm_round.max_staleness_slots, OpalError::StaleQuote);

        let outcome = ResolutionOutcome::from_code(args.outcome_code)
            .ok_or(OpalError::InvalidOutcomeCode)?;

        let round = &mut self.llm_round;
        round.switchboard_quote_slot = Some(args.quote_slot);
        round.response_hash = args.response_hash;
        round.evidence_hash = args.evidence_hash;
        round.outcome_code = Some(args.outcome_code);
        round.outcome = Some(outcome.clone());
        round.resolved_at = Some(clock.unix_timestamp);
        round.challenge_deadline = Some(
            clock
                .unix_timestamp
                .checked_add(self.config.llm_challenge_window_seconds)
                .ok_or(OpalError::Overflow)?,
        );

        self.assertion.state = AssertionState::AssertedLLM;

        Ok(())
    }
}
