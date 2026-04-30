use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::OpalError;
use crate::state::{AssertionAccount, AssertionState, ProtocolConfig, VoteRecord, VoteResolutionRound};

#[derive(Accounts)]
pub struct SettleVoter<'info> {
    pub voter: Signer<'info>,

    #[account(
        seeds = [b"assertion", assertion.id.as_ref()],
        bump = assertion.bump,
        constraint = assertion.state == AssertionState::Resolved @ OpalError::NotResolved,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        seeds = [b"vote_round", assertion.key().as_ref()],
        bump = vote_round.bump,
        constraint = vote_round.final_outcome.is_some() @ OpalError::RoundNotFinalized,
    )]
    pub vote_round: Account<'info, VoteResolutionRound>,

    #[account(
        mut,
        seeds = [b"vote_record", vote_round.key().as_ref(), voter.key().as_ref()],
        bump = vote_record.bump,
        constraint = vote_record.voter == voter.key() @ OpalError::Unauthorized,
        constraint = !vote_record.settled @ OpalError::AlreadySettled,
        constraint = vote_record.choice.is_some() @ OpalError::VoteNotRevealed,
    )]
    pub vote_record: Account<'info, VoteRecord>,

    #[account(
        mut,
        seeds = [b"opal_vault", vote_round.key().as_ref()],
        bump,
        token::mint = voter_opal_account.mint,
    )]
    pub opal_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = opal_vault.mint,
        token::authority = voter,
    )]
    pub voter_opal_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"bond_vault", assertion.key().as_ref()],
        bump,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = bond_vault.mint,
        token::authority = voter,
    )]
    pub voter_pusd_account: Account<'info, TokenAccount>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,

    pub token_program: Program<'info, Token>,
}

impl<'info> SettleVoter<'info> {
    pub fn settle_voter(&mut self, opal_vault_bump: u8, bond_vault_bump: u8) -> Result<()> {
        let final_outcome = self
            .vote_round
            .final_outcome
            .clone()
            .ok_or(OpalError::RoundNotFinalized)?;

        let voter_choice = self
            .vote_record
            .choice
            .clone()
            .ok_or(OpalError::VoteNotRevealed)?;

        let locked_opal = self.vote_record.locked_opal;
        let correct = voter_choice == final_outcome;

        let opal_return = if correct {
            locked_opal
        } else {
            let slash = (locked_opal as u128)
                .checked_mul(self.config.incorrect_vote_slash_bps as u128)
                .ok_or(OpalError::Overflow)?
                .checked_div(10_000)
                .ok_or(OpalError::DivisionByZero)? as u64;
            locked_opal.checked_sub(slash).ok_or(OpalError::Overflow)?
        };

        let assertion_key = self.assertion.key();
        let vote_round_key = self.vote_round.key();

        let opal_seeds: &[&[u8]] = &[b"opal_vault", vote_round_key.as_ref(), &[opal_vault_bump]];
        let opal_signer = &[opal_seeds];

        if opal_return > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    Transfer {
                        from: self.opal_vault.to_account_info(),
                        to: self.voter_opal_account.to_account_info(),
                        authority: self.opal_vault.to_account_info(),
                    },
                    opal_signer,
                ),
                opal_return,
            )?;
        }

        if correct && self.vote_round.total_valid_weight > 0 {
            let total_assertion_bond = self.assertion.assertion_bond;
            let voter_pool = (total_assertion_bond as u128)
                .checked_mul(self.config.voter_reward_share_bps as u128)
                .ok_or(OpalError::Overflow)?
                .checked_div(10_000)
                .ok_or(OpalError::DivisionByZero)?;

            let voting_starts_at = self.vote_round.voting_starts_at.unwrap_or(0);
            let voting_deadline = self.vote_round.voting_deadline.unwrap_or(0);
            let window = voting_deadline.saturating_sub(voting_starts_at).max(1) as u128;
            let time_remaining =
                voting_deadline.saturating_sub(self.vote_record.voted_at).max(0) as u128;
            let my_weight = (locked_opal as u128)
                .checked_mul(time_remaining)
                .ok_or(OpalError::Overflow)?
                .checked_div(window)
                .ok_or(OpalError::DivisionByZero)?;

            let total_winning_weight = match final_outcome {
                crate::state::ResolutionOutcome::True => self.vote_round.aggregate_votes.true_weight,
                crate::state::ResolutionOutcome::False => self.vote_round.aggregate_votes.false_weight,
                crate::state::ResolutionOutcome::TooEarly => self.vote_round.aggregate_votes.too_early_weight,
                crate::state::ResolutionOutcome::Unresolvable => self.vote_round.aggregate_votes.unresolvable_weight,
            };

            if total_winning_weight > 0 {
                let pusd_reward = voter_pool
                    .checked_mul(my_weight)
                    .ok_or(OpalError::Overflow)?
                    .checked_div(total_winning_weight)
                    .ok_or(OpalError::DivisionByZero)? as u64;

                if pusd_reward > 0 {
                    let bond_seeds: &[&[u8]] =
                        &[b"bond_vault", assertion_key.as_ref(), &[bond_vault_bump]];
                    let bond_signer = &[bond_seeds];

                    token::transfer(
                        CpiContext::new_with_signer(
                            self.token_program.to_account_info(),
                            Transfer {
                                from: self.bond_vault.to_account_info(),
                                to: self.voter_pusd_account.to_account_info(),
                                authority: self.bond_vault.to_account_info(),
                            },
                            bond_signer,
                        ),
                        pusd_reward,
                    )?;
                }
            }
        }

        self.vote_record.settled = true;

        Ok(())
    }
}
