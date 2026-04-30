use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::OpalError;
use crate::state::{
    AssertionAccount, AssertionState, LLMDisputeAccount, ProtocolConfig,
    ResolutionOutcome, VoteDisputeAccount, VoteResolutionRound,
};

#[derive(Accounts)]
pub struct FinalizeVoteResolution<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"assertion", assertion.id.as_ref()],
        bump = assertion.bump,
        constraint = assertion.state == AssertionState::Voting @ OpalError::InvalidState,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [b"vote_round", assertion.key().as_ref()],
        bump = vote_round.bump,
        constraint = vote_round.final_outcome.is_none() @ OpalError::AlreadyResolved,
        constraint = !vote_round.settled @ OpalError::AlreadySettled,
    )]
    pub vote_round: Account<'info, VoteResolutionRound>,

    #[account(
        mut,
        seeds = [b"llm_dispute", assertion.key().as_ref()],
        bump = llm_dispute.bump,
        constraint = !llm_dispute.settled @ OpalError::AlreadySettled,
    )]
    pub llm_dispute: Account<'info, LLMDisputeAccount>,

    #[account(
        mut,
        seeds = [b"vote_dispute", assertion.key().as_ref()],
        bump = vote_dispute.bump,
        constraint = !vote_dispute.settled @ OpalError::AlreadySettled,
    )]
    pub vote_dispute: Account<'info, VoteDisputeAccount>,

    #[account(
        mut,
        seeds = [b"bond_vault", assertion.key().as_ref()],
        bump,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = bond_vault.mint,
        constraint = llm_disputer_token_account.owner == llm_dispute.disputer @ OpalError::Unauthorized,
    )]
    pub llm_disputer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = bond_vault.mint,
        constraint = vote_disputer_token_account.owner == vote_dispute.disputer @ OpalError::Unauthorized,
    )]
    pub vote_disputer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = bond_vault.mint,
        constraint = asserter_token_account.owner == assertion.asserter @ OpalError::Unauthorized,
    )]
    pub asserter_token_account: Account<'info, TokenAccount>,

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

impl<'info> FinalizeVoteResolution<'info> {
    pub fn finalize_vote_resolution(&mut self, bond_vault_bump: u8) -> Result<()> {
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        let reveal_deadline = self
            .vote_round
            .reveal_deadline
            .ok_or(OpalError::InvalidState)?;
        require!(now > reveal_deadline, OpalError::VotingWindowOpen);

        let total = self.vote_round.total_valid_weight;
        let final_outcome = if total == 0 {
            ResolutionOutcome::Unresolvable
        } else {
            match self.vote_round.aggregate_votes.leading() {
                Some((outcome, weight)) => {
                    // weight * 10_000 >= total * supermajority_bps
                    let threshold = (total as u128)
                        .checked_mul(self.config.supermajority_bps as u128)
                        .ok_or(OpalError::Overflow)?;
                    let scaled_weight = weight
                        .checked_mul(10_000)
                        .ok_or(OpalError::Overflow)?;
                    if scaled_weight >= threshold {
                        outcome
                    } else {
                        ResolutionOutcome::Unresolvable
                    }
                }
                None => ResolutionOutcome::Unresolvable,
            }
        };

        let llm_dispute_correct = final_outcome != ResolutionOutcome::True;
        let vote_dispute_correct = final_outcome != self.vote_dispute.challenged_llm_resolution;

        let assertion_bond = self.assertion.assertion_bond;
        let llm_bond = self.llm_dispute.bond_amount_pusd;
        let vote_bond = self.vote_dispute.bond_amount_pusd;

        let assertion_key = self.assertion.key();
        let vault_seeds: &[&[u8]] = &[b"bond_vault", assertion_key.as_ref(), &[bond_vault_bump]];
        let signer = &[vault_seeds];

        // Helper closure is not possible due to borrow rules; use a local fn instead.
        self.settle_bonds(
            llm_dispute_correct,
            vote_dispute_correct,
            assertion_bond,
            llm_bond,
            vote_bond,
            signer,
        )?;

        self.vote_round.final_outcome = Some(final_outcome.clone());
        self.vote_round.settled = true;

        self.llm_dispute.settlement_resolution = Some(final_outcome.clone());
        self.llm_dispute.dispute_correct = Some(llm_dispute_correct);
        self.llm_dispute.settled = true;

        self.vote_dispute.settlement_resolution = Some(final_outcome.clone());
        self.vote_dispute.dispute_correct = Some(vote_dispute_correct);
        self.vote_dispute.settled = true;

        self.assertion.state = AssertionState::Resolved;
        self.assertion.outcome = Some(final_outcome);
        self.assertion.finalized_at = Some(now);

        Ok(())
    }

    fn settle_bonds(
        &self,
        llm_correct: bool,
        vote_correct: bool,
        assertion_bond: u64,
        llm_bond: u64,
        vote_bond: u64,
        signer: &[&[&[u8]]],
    ) -> Result<()> {
        let cfg = &self.config;

        match (llm_correct, vote_correct) {
            (true, true) => {
                let llm_reward = bps_of(assertion_bond, cfg.llm_disputer_reward_share_bps)?;
                let vote_reward = bps_of(assertion_bond, cfg.vote_disputer_reward_share_bps)?;
                let treasury_cut = bps_of(assertion_bond, cfg.treasury_share_bps)?;

                let llm_out = llm_bond.checked_add(llm_reward).ok_or(OpalError::Overflow)?;
                transfer_from_vault(self, llm_out, &self.llm_disputer_token_account.to_account_info(), signer)?;

                let vote_out = vote_bond.checked_add(vote_reward).ok_or(OpalError::Overflow)?;
                transfer_from_vault(self, vote_out, &self.vote_disputer_token_account.to_account_info(), signer)?;

                if treasury_cut > 0 {
                    transfer_from_vault(self, treasury_cut, &self.treasury_token_account.to_account_info(), signer)?;
                }
            }
            (true, false) => {
                let llm_reward = bps_of(assertion_bond, cfg.llm_disputer_reward_share_bps)?;
                let treasury_cut = bps_of(
                    assertion_bond.checked_add(vote_bond).ok_or(OpalError::Overflow)?,
                    cfg.treasury_share_bps,
                )?;

                let llm_out = llm_bond.checked_add(llm_reward).ok_or(OpalError::Overflow)?;
                transfer_from_vault(self, llm_out, &self.llm_disputer_token_account.to_account_info(), signer)?;

                if treasury_cut > 0 {
                    transfer_from_vault(self, treasury_cut, &self.treasury_token_account.to_account_info(), signer)?;
                }
            }
            (false, true) => {
                let fee = bps_of(assertion_bond, cfg.protocol_fee_bps)?;
                let asserter_return = assertion_bond.checked_sub(fee).ok_or(OpalError::Overflow)?;

                let vote_reward = bps_of(llm_bond, cfg.vote_disputer_reward_share_bps)?;
                let treasury_cut = fee.checked_add(bps_of(llm_bond, cfg.treasury_share_bps)?)
                    .ok_or(OpalError::Overflow)?;

                transfer_from_vault(self, asserter_return, &self.asserter_token_account.to_account_info(), signer)?;

                let vote_out = vote_bond.checked_add(vote_reward).ok_or(OpalError::Overflow)?;
                transfer_from_vault(self, vote_out, &self.vote_disputer_token_account.to_account_info(), signer)?;

                if treasury_cut > 0 {
                    transfer_from_vault(self, treasury_cut, &self.treasury_token_account.to_account_info(), signer)?;
                }
            }
            (false, false) => {
                let fee = bps_of(assertion_bond, cfg.protocol_fee_bps)?;
                let asserter_return = assertion_bond.checked_sub(fee).ok_or(OpalError::Overflow)?;

                let total_slashed = llm_bond.checked_add(vote_bond).ok_or(OpalError::Overflow)?;
                let treasury_cut = fee.checked_add(bps_of(total_slashed, cfg.treasury_share_bps)?)
                    .ok_or(OpalError::Overflow)?;

                transfer_from_vault(self, asserter_return, &self.asserter_token_account.to_account_info(), signer)?;

                if treasury_cut > 0 {
                    transfer_from_vault(self, treasury_cut, &self.treasury_token_account.to_account_info(), signer)?;
                }
            }
        }

        Ok(())
    }
}

fn bps_of(amount: u64, bps: u16) -> Result<u64> {
    (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(OpalError::Overflow)?
        .checked_div(10_000)
        .ok_or(OpalError::DivisionByZero)
        .map(|v| v as u64)
        .map_err(Into::into)
}

fn transfer_from_vault<'info>(
    ctx: &FinalizeVoteResolution<'info>,
    amount: u64,
    destination: &AccountInfo<'info>,
    signer: &[&[&[u8]]],
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    token::transfer(
        CpiContext::new_with_signer(
            ctx.token_program.to_account_info(),
            Transfer {
                from: ctx.bond_vault.to_account_info(),
                to: destination.clone(),
                authority: ctx.bond_vault.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;
    Ok(())
}
