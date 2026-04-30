use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};
use crate::errors::OpalError;
use crate::state::{AssertionAccount, AssertionState, ResolutionOutcome, VoteRecord, VoteResolutionRound};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RevealVoteArgs {
    pub choice: ResolutionOutcome,
    pub nonce: [u8; 32],
}

#[derive(Accounts)]
pub struct RevealVote<'info> {
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
        mut,
        seeds = [b"vote_record", vote_round.key().as_ref(), voter.key().as_ref()],
        bump = vote_record.bump,
        constraint = vote_record.voter == voter.key() @ OpalError::Unauthorized,
        constraint = vote_record.choice.is_none() @ OpalError::AlreadyRevealed,
    )]
    pub vote_record: Account<'info, VoteRecord>,
}

impl<'info> RevealVote<'info> {
    pub fn reveal_vote(&mut self, args: RevealVoteArgs) -> Result<()> {
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        let voting_deadline = self
            .vote_round
            .voting_deadline
            .ok_or(OpalError::RevealWindowNotOpen)?;
        let reveal_deadline = self
            .vote_round
            .reveal_deadline
            .ok_or(OpalError::RevealWindowNotOpen)?;

        require!(now > voting_deadline, OpalError::RevealWindowNotOpen);
        require!(now <= reveal_deadline, OpalError::RevealWindowExpired);

        let choice_byte = match args.choice {
            ResolutionOutcome::True => 0u8,
            ResolutionOutcome::False => 1u8,
            ResolutionOutcome::TooEarly => 2u8,
            ResolutionOutcome::Unresolvable => 3u8,
        };
        let preimage: Vec<u8> = std::iter::once(choice_byte)
            .chain(args.nonce.iter().copied())
            .collect();
        let computed: [u8; 32] = Sha256::digest(&preimage).into();
        require!(computed == self.vote_record.commitment, OpalError::InvalidCommitment);

        let voting_starts_at = self
            .vote_round
            .voting_starts_at
            .ok_or(OpalError::RevealWindowNotOpen)?;

        // vote_influence = locked_opal * (voting_deadline - voted_at) / (voting_deadline - voting_starts_at)
        let window = voting_deadline
            .checked_sub(voting_starts_at)
            .ok_or(OpalError::Overflow)? as u128;

        let time_remaining = voting_deadline
            .saturating_sub(self.vote_record.voted_at)
            .max(0) as u128;

        let influence = if window == 0 {
            self.vote_record.locked_opal as u128
        } else {
            (self.vote_record.locked_opal as u128)
                .checked_mul(time_remaining)
                .ok_or(OpalError::Overflow)?
                .checked_div(window)
                .ok_or(OpalError::DivisionByZero)?
        };

        self.vote_round
            .aggregate_votes
            .add(&args.choice, influence)
            .ok_or(OpalError::Overflow)?;

        self.vote_round.total_valid_weight = self
            .vote_round
            .total_valid_weight
            .checked_add(influence)
            .ok_or(OpalError::Overflow)?;

        self.vote_record.choice = Some(args.choice);
        self.vote_record.revealed_at = Some(now);

        Ok(())
    }
}
