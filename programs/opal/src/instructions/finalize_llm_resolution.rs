use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::OpalError;
use crate::state::{
    AssertionAccount, AssertionState, LLMDisputeAccount, LLMResolutionRound, ProtocolConfig,
    ResolutionOutcome,
};

#[derive(Accounts)]
pub struct FinalizeLLMResolution<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"assertion", assertion.id.as_ref()],
        bump = assertion.bump,
        constraint = assertion.state == AssertionState::AssertedLLM @ OpalError::InvalidState,
        constraint = assertion.vote_dispute.is_none() @ OpalError::InvalidState,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [b"llm_round", assertion.key().as_ref()],
        bump = llm_round.bump,
        constraint = llm_round.outcome.is_some() @ OpalError::InvalidState,
        constraint = !llm_round.settled @ OpalError::AlreadySettled,
    )]
    pub llm_round: Account<'info, LLMResolutionRound>,

    #[account(
        mut,
        seeds = [b"llm_dispute", assertion.key().as_ref()],
        bump = llm_dispute.bump,
        constraint = !llm_dispute.settled @ OpalError::AlreadySettled,
    )]
    pub llm_dispute: Account<'info, LLMDisputeAccount>,

    #[account(
        mut,
        seeds = [b"bond_vault", assertion.key().as_ref()],
        bump,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = bond_vault.mint,
        constraint = asserter_token_account.owner == assertion.asserter @ OpalError::Unauthorized,
    )]
    pub asserter_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = bond_vault.mint,
        constraint = disputer_token_account.owner == llm_dispute.disputer @ OpalError::Unauthorized,
    )]
    pub disputer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = bond_vault.mint,
        constraint = treasury_token_account.key() == config.treasury @ OpalError::Unauthorized,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,

    pub token_program: Program<'info, Token>,
}

impl<'info> FinalizeLLMResolution<'info> {
    pub fn finalize_llm_resolution(&mut self, bond_vault_bump: u8) -> Result<()> {
        let clock = Clock::get()?;

        let deadline = self
            .llm_round
            .challenge_deadline
            .ok_or(OpalError::InvalidState)?;
        require!(clock.unix_timestamp > deadline, OpalError::ChallengeWindowExpired);

        let outcome = self
            .llm_round
            .outcome
            .clone()
            .ok_or(OpalError::InvalidState)?;

        let dispute_correct = outcome != ResolutionOutcome::True;

        let assertion_bond = self.assertion.assertion_bond;
        let dispute_bond = self.llm_dispute.bond_amount_pusd;

        let assertion_key = self.assertion.key();
        let vault_seeds: &[&[u8]] = &[b"bond_vault", assertion_key.as_ref(), &[bond_vault_bump]];
        let signer = &[vault_seeds];

        if dispute_correct {
            let reward = (assertion_bond as u128)
                .checked_mul(self.config.llm_disputer_reward_share_bps as u128)
                .ok_or(OpalError::Overflow)?
                .checked_div(10_000)
                .ok_or(OpalError::DivisionByZero)? as u64;

            let treasury_cut = (assertion_bond as u128)
                .checked_mul(self.config.treasury_share_bps as u128)
                .ok_or(OpalError::Overflow)?
                .checked_div(10_000)
                .ok_or(OpalError::DivisionByZero)? as u64;

            let disputer_payout = dispute_bond.checked_add(reward).ok_or(OpalError::Overflow)?;
            self.transfer_from_vault(disputer_payout, &self.disputer_token_account.to_account_info(), signer)?;

            if treasury_cut > 0 {
                self.transfer_from_vault(treasury_cut, &self.treasury_token_account.to_account_info(), signer)?;
            }
        } else {
            let fee = (assertion_bond as u128)
                .checked_mul(self.config.protocol_fee_bps as u128)
                .ok_or(OpalError::Overflow)?
                .checked_div(10_000)
                .ok_or(OpalError::DivisionByZero)? as u64;
            let asserter_return = assertion_bond.checked_sub(fee).ok_or(OpalError::Overflow)?;

            let treasury_cut = fee.checked_add(
                (dispute_bond as u128)
                    .checked_mul(self.config.treasury_share_bps as u128)
                    .ok_or(OpalError::Overflow)?
                    .checked_div(10_000)
                    .ok_or(OpalError::DivisionByZero)? as u64,
            ).ok_or(OpalError::Overflow)?;

            self.transfer_from_vault(asserter_return, &self.asserter_token_account.to_account_info(), signer)?;

            if treasury_cut > 0 {
                self.transfer_from_vault(treasury_cut, &self.treasury_token_account.to_account_info(), signer)?;
            }
        }

        let now = clock.unix_timestamp;

        self.llm_dispute.settlement_resolution = Some(outcome.clone());
        self.llm_dispute.dispute_correct = Some(dispute_correct);
        self.llm_dispute.settled = true;

        self.llm_round.settled = true;

        self.assertion.state = AssertionState::Resolved;
        self.assertion.outcome = Some(outcome);
        self.assertion.finalized_at = Some(now);

        Ok(())
    }

    fn transfer_from_vault(
        &self,
        amount: u64,
        destination: &AccountInfo<'info>,
        signer: &[&[&[u8]]],
    ) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.bond_vault.to_account_info(),
                    to: destination.clone(),
                    authority: self.bond_vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;
        Ok(())
    }
}
