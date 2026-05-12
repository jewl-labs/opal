use crate::{
    constants::{BOOL_TRUE, VOTE_RECORD_SEED, VOTE_ROUND_SEED},
    errors::OpalError,
    state::{VoteRecord, VoteResolutionRound},
    utils::{is_timestamp_set, validate_outcome_code},
};
use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RevealVoteArgs {
    pub outcome: u8,
    pub nonce: [u8; 32],
}

#[derive(Accounts)]
pub struct RevealVote<'info> {
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [VOTE_ROUND_SEED, vote_resolution_round.load()?.assertion.as_ref()],
        bump = vote_resolution_round.load()?.bump,
    )]
    pub vote_resolution_round: AccountLoader<'info, VoteResolutionRound>,

    #[account(
        mut,
        seeds = [VOTE_RECORD_SEED, vote_resolution_round.key().as_ref(), voter.key().as_ref()],
        bump = vote_record.load()?.bump,
        constraint = vote_record.load()?.voter == voter.key() @ OpalError::Unauthorized,
        constraint = vote_record.load()?.vote_round == vote_resolution_round.key() @ OpalError::RoundLinkMismatch,
    )]
    pub vote_record: AccountLoader<'info, VoteRecord>,
}

pub fn handler(ctx: Context<RevealVote>, args: RevealVoteArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let vote_round = ctx.accounts.vote_resolution_round.load()?;
    let record = ctx.accounts.vote_record.load()?;

    require!(
        vote_round.delegated == BOOL_TRUE,
        OpalError::VoteNotOpen
    );
    require!(
        is_timestamp_set(vote_round.voting_deadline),
        OpalError::VoteNotOpen
    );
    require!(
        now >= vote_round.voting_deadline,
        OpalError::RevealWindowNotOpen
    );
    require!(
        now < vote_round.reveal_deadline,
        OpalError::RevealWindowClosed
    );
    require!(record.revealed == 0, OpalError::AlreadyRevealed);

    // Verify the commit: SHA-256(outcome || nonce) must match the stored hash.
    let mut preimage = [0u8; 33];
    preimage[0] = args.outcome;
    preimage[1..].copy_from_slice(&args.nonce);
    let computed: [u8; 32] = Sha256::digest(&preimage).into();
    require!(computed == record.commit_hash, OpalError::InvalidVoteHash);

    let outcome = validate_outcome_code(args.outcome)?;
    let weight = record.opal_weight;
    drop(record);
    drop(vote_round);

    // Accumulate weight into the appropriate bucket on VoteResolutionRound (runs on ER).
    let mut vote_round = ctx.accounts.vote_resolution_round.load_mut()?;
    match outcome {
        0 => {
            vote_round.aggregate_votes.true_weight = vote_round
                .aggregate_votes
                .true_weight
                .checked_add(weight as u128)
                .ok_or(OpalError::MathOverflow)?;
        }
        1 => {
            vote_round.aggregate_votes.false_weight = vote_round
                .aggregate_votes
                .false_weight
                .checked_add(weight as u128)
                .ok_or(OpalError::MathOverflow)?;
        }
        2 => {
            vote_round.aggregate_votes.too_early_weight = vote_round
                .aggregate_votes
                .too_early_weight
                .checked_add(weight as u128)
                .ok_or(OpalError::MathOverflow)?;
        }
        _ => {
            vote_round.aggregate_votes.unresolvable_weight = vote_round
                .aggregate_votes
                .unresolvable_weight
                .checked_add(weight as u128)
                .ok_or(OpalError::MathOverflow)?;
        }
    }
    vote_round.total_valid_weight = vote_round
        .total_valid_weight
        .checked_add(weight as u128)
        .ok_or(OpalError::MathOverflow)?;
    drop(vote_round);

    let mut record = ctx.accounts.vote_record.load_mut()?;
    record.outcome = outcome;
    record.revealed = BOOL_TRUE;
    record.nonce = args.nonce;

    Ok(())
}
