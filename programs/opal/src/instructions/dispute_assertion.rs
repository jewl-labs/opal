use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::OpalError;
use crate::state::{
    AssertionAccount, AssertionState, LLMDisputeAccount, LLMResolutionRound, ProtocolConfig,
};

#[derive(Accounts)]
pub struct DisputeAssertion<'info> {
    #[account(
        mut,
        seeds = [b"assertion", assertion.asserter.as_ref(), &assertion.assertion_id.to_le_bytes()],
        bump = assertion.bump,
    )]
    pub assertion: Box<Account<'info, AssertionAccount>>,

    #[account(
        init,
        payer = disputer,
        space = 8 + LLMDisputeAccount::INIT_SPACE,
        seeds = [b"llm_dispute", assertion.key().as_ref()],
        bump,
    )]
    pub llm_dispute: Box<Account<'info, LLMDisputeAccount>>,

    #[account(
        init,
        payer = disputer,
        space = 8 + LLMResolutionRound::INIT_SPACE,
        seeds = [b"llm_resolution", assertion.key().as_ref()],
        bump,
    )]
    pub llm_resolution_round: Box<Account<'info, LLMResolutionRound>>,

    /// Disputer bond is deposited into the existing assertion vault.
    #[account(
        mut,
        seeds = [b"bond_vault", assertion.key().as_ref()],
        bump,
        token::mint = pusd_mint,
        token::authority = assertion,
    )]
    pub bond_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = disputer_pusd.owner == disputer.key() @ OpalError::Unauthorized,
        constraint = disputer_pusd.mint == pusd_mint.key() @ OpalError::InvalidState,
    )]
    pub disputer_pusd: Box<Account<'info, TokenAccount>>,

    pub pusd_mint: Account<'info, Mint>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub disputer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> DisputeAssertion<'info> {
    pub fn dispute_assertion(
        &mut self,
        bumps: &DisputeAssertionBumps,
        bond_amount: u64,
        switchboard_feed_hash: [u8; 32],
    ) -> Result<()> {
        let clock = Clock::get()?;
        let bond_min = self.protocol_config.assertion_bond_min;
        let switchboard_queue = self.protocol_config.switchboard_queue;
        let max_staleness_slots = self.protocol_config.max_staleness_slots;

        require!(
            self.assertion.state == AssertionState::Asserted,
            OpalError::InvalidState
        );
        require!(
            clock.unix_timestamp < self.assertion.liveness_deadline,
            OpalError::LivenessWindowExpired
        );
        require!(bond_amount >= bond_min, OpalError::BondTooSmall);

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.disputer_pusd.to_account_info(),
                    to: self.bond_vault.to_account_info(),
                    authority: self.disputer.to_account_info(),
                },
            ),
            bond_amount,
        )?;

        let assertion_key = self.assertion.key();
        let dispute_key = self.llm_dispute.key();
        let round_key = self.llm_resolution_round.key();

        let llm_dispute = &mut self.llm_dispute;
        llm_dispute.assertion = assertion_key;
        llm_dispute.disputer = self.disputer.key();
        llm_dispute.bond_amount = bond_amount;
        llm_dispute.created_at = clock.unix_timestamp;
        llm_dispute.resolution_round = round_key;
        llm_dispute.settlement_resolution = None;
        llm_dispute.dispute_correct = None;
        llm_dispute.settled = false;
        llm_dispute.bump = bumps.llm_dispute;

        let round = &mut self.llm_resolution_round;
        round.assertion = assertion_key;
        round.dispute = dispute_key;
        round.switchboard_queue = switchboard_queue;
        round.switchboard_feed_hash = switchboard_feed_hash;
        round.max_staleness_slots = max_staleness_slots;
        round.prompt_hash = [0u8; 32];
        round.outcome_code = None;
        round.outcome = None;
        round.requested_at = clock.unix_timestamp;
        round.resolved_at = None;
        round.challenge_deadline = None;
        round.settled = false;
        round.bump = bumps.llm_resolution_round;

        let assertion = &mut self.assertion;
        assertion.state = AssertionState::PendingLLM;
        assertion.dispute_count = 1;
        assertion.llm_dispute = Some(dispute_key);
        assertion.llm_resolution_round = Some(round_key);

        Ok(())
    }
}
