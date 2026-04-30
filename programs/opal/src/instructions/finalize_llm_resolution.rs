use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::OpalError;
use crate::state::{
    AssertionAccount, AssertionState, LLMDisputeAccount, LLMResolutionRound, ProtocolConfig,
    ResolutionOutcome,
};

#[derive(Accounts)]
pub struct FinalizeLlmResolution<'info> {
    #[account(
        mut,
        seeds = [b"assertion", assertion.asserter.as_ref(), &assertion.assertion_id.to_le_bytes()],
        bump = assertion.bump,
    )]
    pub assertion: Box<Account<'info, AssertionAccount>>,

    #[account(
        mut,
        seeds = [b"llm_dispute", assertion.key().as_ref()],
        bump = llm_dispute.bump,
        constraint = llm_dispute.assertion == assertion.key() @ OpalError::InvalidState,
    )]
    pub llm_dispute: Box<Account<'info, LLMDisputeAccount>>,

    #[account(
        mut,
        seeds = [b"llm_resolution", assertion.key().as_ref()],
        bump = llm_resolution_round.bump,
        constraint = llm_resolution_round.assertion == assertion.key() @ OpalError::InvalidState,
    )]
    pub llm_resolution_round: Box<Account<'info, LLMResolutionRound>>,

    #[account(
        mut,
        seeds = [b"bond_vault", assertion.key().as_ref()],
        bump,
        token::mint = asserter_pusd.mint,
        token::authority = assertion,
    )]
    pub bond_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = asserter_pusd.owner == assertion.asserter @ OpalError::Unauthorized,
    )]
    pub asserter_pusd: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = disputer_pusd.owner == llm_dispute.disputer @ OpalError::Unauthorized,
    )]
    pub disputer_pusd: Box<Account<'info, TokenAccount>>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    pub token_program: Program<'info, Token>,

    /// Anyone can trigger finalization after the challenge window expires.
    pub caller: Signer<'info>,
}

impl<'info> FinalizeLlmResolution<'info> {
    pub fn finalize_llm_resolution(&mut self) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            self.assertion.state == AssertionState::AssertedLLM,
            OpalError::InvalidState
        );
        require!(!self.llm_dispute.settled, OpalError::AlreadySettled);

        let challenge_deadline = self
            .llm_resolution_round
            .challenge_deadline
            .ok_or(OpalError::MissingChallengeDeadline)?;
        require!(
            clock.unix_timestamp > challenge_deadline,
            OpalError::ChallengeWindowActive
        );

        let outcome = self
            .llm_resolution_round
            .outcome
            .ok_or(OpalError::MissingOutcome)?;

        // Copy values needed for signer seeds and bond transfer.
        let asserter = self.assertion.asserter;
        let assertion_id_bytes = self.assertion.assertion_id.to_le_bytes();
        let bump = self.assertion.bump;
        let asserter_bond = self.assertion.bond_amount;
        let disputer_bond = self.llm_dispute.bond_amount;
        let total = asserter_bond
            .checked_add(disputer_bond)
            .expect("bond overflow");

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"assertion",
            asserter.as_ref(),
            assertion_id_bytes.as_ref(),
            &[bump],
        ]];

        // disputer wins when the LLM outcome is anything other than True.
        let dispute_correct = outcome != ResolutionOutcome::True;

        let winner_account = if dispute_correct {
            self.disputer_pusd.to_account_info()
        } else {
            self.asserter_pusd.to_account_info()
        };

        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.bond_vault.to_account_info(),
                    to: winner_account,
                    authority: self.assertion.to_account_info(),
                },
                signer_seeds,
            ),
            total,
        )?;

        self.llm_dispute.settlement_resolution = Some(outcome);
        self.llm_dispute.dispute_correct = Some(dispute_correct);
        self.llm_dispute.settled = true;

        self.llm_resolution_round.settled = true;

        self.assertion.state = AssertionState::Resolved;
        self.assertion.outcome = Some(outcome);
        self.assertion.finalized_at = Some(clock.unix_timestamp);

        Ok(())
    }
}
