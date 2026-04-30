use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::errors::OpalError;
use crate::state::{AssertionAccount, AssertionState, ProtocolConfig, VoteResolutionRound};

#[derive(Accounts)]
pub struct OpenVote<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"assertion", assertion.id.as_ref()],
        bump = assertion.bump,
        constraint = assertion.state == AssertionState::PendingVote @ OpalError::InvalidState,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [b"vote_round", assertion.key().as_ref()],
        bump = vote_round.bump,
        constraint = vote_round.voting_starts_at.is_none() @ OpalError::InvalidState,
    )]
    pub vote_round: Account<'info, VoteResolutionRound>,

    #[account(
        init,
        payer = caller,
        token::mint = opal_mint,
        token::authority = opal_vault,
        seeds = [b"opal_vault", vote_round.key().as_ref()],
        bump,
    )]
    pub opal_vault: Account<'info, TokenAccount>,

    pub opal_mint: Account<'info, Mint>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> OpenVote<'info> {
    pub fn open_vote(&mut self) -> Result<()> {
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        // V1: setup window not enforced on-chain (no dispute timestamp stored).
        let voting_starts_at = now;
        let voting_deadline = now
            .checked_add(self.config.voting_window_seconds)
            .ok_or(OpalError::Overflow)?;
        let reveal_deadline = voting_deadline
            .checked_add(self.config.reveal_window_seconds)
            .ok_or(OpalError::Overflow)?;

        let vr = &mut self.vote_round;
        vr.voting_starts_at = Some(voting_starts_at);
        vr.voting_deadline = Some(voting_deadline);
        vr.reveal_deadline = Some(reveal_deadline);
        vr.delegated = false;
        vr.committed = false;

        self.assertion.state = AssertionState::Voting;

        Ok(())
    }
}
