use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::errors::OpalError;
use crate::state::{
    AssertionAccount, AssertionState, LLMDisputeAccount, LLMResolutionRound, ProtocolConfig,
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DisputeAssertionArgs {
    pub prompt_hash: [u8; 32],
    pub variable_overrides_hash: Option<[u8; 32]>,
}

#[derive(Accounts)]
pub struct DisputeAssertion<'info> {
    #[account(mut)]
    pub disputer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"assertion", assertion.id.as_ref()],
        bump = assertion.bump,
        constraint = assertion.state == AssertionState::Asserted @ OpalError::InvalidState,
        constraint = assertion.dispute_count == 0 @ OpalError::AlreadyDisputed,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        init,
        payer = disputer,
        space = 8 + LLMDisputeAccount::INIT_SPACE,
        seeds = [b"llm_dispute", assertion.key().as_ref()],
        bump,
    )]
    pub llm_dispute: Account<'info, LLMDisputeAccount>,

    #[account(
        init,
        payer = disputer,
        space = 8 + LLMResolutionRound::INIT_SPACE,
        seeds = [b"llm_round", assertion.key().as_ref()],
        bump,
    )]
    pub llm_round: Account<'info, LLMResolutionRound>,

    #[account(
        mut,
        seeds = [b"bond_vault", assertion.key().as_ref()],
        bump,
        token::mint = pusd_mint,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pusd_mint,
        token::authority = disputer,
    )]
    pub disputer_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub pusd_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> DisputeAssertion<'info> {
    pub fn dispute_assertion(
        &mut self,
        args: DisputeAssertionArgs,
        bumps: &DisputeAssertionBumps,
    ) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            clock.unix_timestamp < self.assertion.liveness_deadline,
            OpalError::LivenessExpired
        );

        let required_bond = self
            .config
            .required_llm_dispute_bond(self.assertion.assertion_bond)
            .ok_or(OpalError::Overflow)?;

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.disputer_token_account.to_account_info(),
                    to: self.bond_vault.to_account_info(),
                    authority: self.disputer.to_account_info(),
                },
            ),
            required_bond,
        )?;

        let dispute = &mut self.llm_dispute;
        dispute.assertion = self.assertion.key();
        dispute.disputer = self.disputer.key();
        dispute.bond_amount_pusd = required_bond;
        dispute.created_at = clock.unix_timestamp;
        dispute.resolution_round = self.llm_round.key();
        dispute.settlement_resolution = None;
        dispute.dispute_correct = None;
        dispute.settled = false;
        dispute.bump = bumps.llm_dispute;

        let round = &mut self.llm_round;
        round.assertion = self.assertion.key();
        round.dispute = self.llm_dispute.key();
        round.switchboard_feed = self.config.switchboard_feed;
        round.switchboard_feed_hash = self.config.switchboard_feed_hash;
        round.switchboard_quote_slot = None;
        round.max_staleness_slots = self.config.max_staleness_slots;
        round.prompt_hash = args.prompt_hash;
        round.variable_overrides_hash = args.variable_overrides_hash;
        round.response_hash = None;
        round.evidence_hash = None;
        round.outcome_code = None;
        round.outcome = None;
        round.requested_at = clock.unix_timestamp;
        round.resolved_at = None;
        round.challenge_deadline = None;
        round.settled = false;
        round.bump = bumps.llm_round;

        let assertion = &mut self.assertion;
        assertion.state = AssertionState::PendingLLM;
        assertion.dispute_count = 1;
        assertion.llm_dispute = Some(self.llm_dispute.key());
        assertion.llm_resolution_round = Some(self.llm_round.key());

        Ok(())
    }
}
