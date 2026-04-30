use anchor_lang::prelude::*;
use switchboard_on_demand::QuoteVerifier;

use crate::errors::OpalError;
use crate::state::{AssertionAccount, AssertionState, LLMResolutionRound, ProtocolConfig, ResolutionOutcome};

#[derive(Accounts)]
pub struct SubmitLlmResolution<'info> {
    #[account(
        mut,
        seeds = [b"assertion", assertion.asserter.as_ref(), &assertion.assertion_id.to_le_bytes()],
        bump = assertion.bump,
    )]
    pub assertion: Box<Account<'info, AssertionAccount>>,

    #[account(
        mut,
        seeds = [b"llm_resolution", assertion.key().as_ref()],
        bump = llm_resolution_round.bump,
        constraint = llm_resolution_round.assertion == assertion.key() @ OpalError::InvalidState,
    )]
    pub llm_resolution_round: Box<Account<'info, LLMResolutionRound>>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// CHECK: Address verified against the queue stored on LLMResolutionRound at dispute time.
    #[account(
        address = llm_resolution_round.switchboard_queue @ OpalError::InvalidFeed,
    )]
    pub switchboard_queue: AccountInfo<'info>,

    /// CHECK: Instructions sysvar — QuoteVerifier reads the secp256k1 verify
    /// instruction prepended by the client to extract and authenticate oracle data.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: AccountInfo<'info>,

    pub submitter: Signer<'info>,
}

impl<'info> SubmitLlmResolution<'info> {
    pub fn submit_llm_resolution(&mut self, prompt_hash: [u8; 32]) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            self.assertion.state == AssertionState::PendingLLM,
            OpalError::InvalidState
        );

        // Verify the Switchboard oracle quote.
        // The client must prepend a sigVerifyIx (from queue.fetchQuoteIx via Crossbar)
        // as instruction 0 in the same transaction before this instruction.
        let quote = QuoteVerifier::new()
            .queue(&self.switchboard_queue)
            .max_age(self.llm_resolution_round.max_staleness_slots)
            .verify_instruction_at(0)
            .map_err(|_| error!(OpalError::InvalidQuote))?;

        // Verify the feed identity matches what was committed at dispute time.
        let feeds = quote.feeds();
        require!(!feeds.is_empty(), OpalError::NoFeedData);
        let feed = &feeds[0];

        // PackedFeedInfo exposes the hash via hex_id(); encode stored bytes to compare.
        let expected_hex: String = self
            .llm_resolution_round
            .switchboard_feed_hash
            .iter()
            .fold(String::with_capacity(64), |mut s, b| {
                s.push_str(&format!("{:02x}", b));
                s
            });
        require!(feed.hex_id() == expected_hex, OpalError::FeedHashMismatch);

        // The feed returns a plain integer: 0 = True, 1 = False, 2 = TooEarly, 3 = Unresolvable.
        // No decimal scaling is used — the HTTP resolver endpoint is responsible for
        // returning the integer directly (not scaled by 10^18).
        let raw = feed.value();
        let outcome_code = u8::try_from(raw).map_err(|_| error!(OpalError::InvalidOutcomeCode))?;
        let outcome = match outcome_code {
            0 => ResolutionOutcome::True,
            1 => ResolutionOutcome::False,
            2 => ResolutionOutcome::TooEarly,
            3 => ResolutionOutcome::Unresolvable,
            _ => return err!(OpalError::InvalidOutcomeCode),
        };

        let challenge_window = self.protocol_config.llm_challenge_window_secs;

        let round = &mut self.llm_resolution_round;
        round.prompt_hash = prompt_hash;
        round.outcome_code = Some(outcome_code);
        round.outcome = Some(outcome);
        round.resolved_at = Some(clock.unix_timestamp);
        round.challenge_deadline = Some(clock.unix_timestamp + challenge_window);

        self.assertion.state = AssertionState::AssertedLLM;

        Ok(())
    }
}
