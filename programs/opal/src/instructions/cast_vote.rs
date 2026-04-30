use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::errors::OpalError;
use crate::state::{AssertionAccount, AssertionState, ProtocolConfig, VoteRecord, VoteResolutionRound};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CastVoteArgs {
    /// sha256(choice_byte || nonce) — hides vote direction until reveal.
    pub commitment: [u8; 32],
    pub locked_opal: u64,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        seeds = [b"assertion", assertion.id.as_ref()],
        bump = assertion.bump,
        constraint = assertion.state == AssertionState::Voting @ OpalError::InvalidState,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [b"vote_round", assertion.key().as_ref()],
        bump = vote_round.bump,
    )]
    pub vote_round: Account<'info, VoteResolutionRound>,

    #[account(
        init,
        payer = voter,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"vote_record", vote_round.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub vote_record: Account<'info, VoteRecord>,

    #[account(
        mut,
        seeds = [b"opal_vault", vote_round.key().as_ref()],
        bump,
        token::mint = opal_mint,
    )]
    pub opal_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = opal_mint,
        token::authority = voter,
    )]
    pub voter_opal_account: Account<'info, TokenAccount>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,

    pub opal_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> CastVote<'info> {
    pub fn cast_vote(&mut self, args: CastVoteArgs, bumps: &CastVoteBumps) -> Result<()> {
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        require!(args.locked_opal > 0, OpalError::InsufficientOpal);

        let voting_starts_at = self
            .vote_round
            .voting_starts_at
            .ok_or(OpalError::VotingNotStarted)?;
        let voting_deadline = self
            .vote_round
            .voting_deadline
            .ok_or(OpalError::VotingNotStarted)?;

        require!(now >= voting_starts_at, OpalError::VotingNotStarted);
        require!(now <= voting_deadline, OpalError::VotingWindowClosed);

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.voter_opal_account.to_account_info(),
                    to: self.opal_vault.to_account_info(),
                    authority: self.voter.to_account_info(),
                },
            ),
            args.locked_opal,
        )?;

        let record = &mut self.vote_record;
        record.vote_round = self.vote_round.key();
        record.voter = self.voter.key();
        record.locked_opal = args.locked_opal;
        record.commitment = args.commitment;
        record.choice = None;
        record.voted_at = now;
        record.revealed_at = None;
        record.settled = false;
        record.bump = bumps.vote_record;

        Ok(())
    }
}
