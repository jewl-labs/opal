use crate::{
    constants::{ASSERTION_SEED, ASSERTION_STATE_VOTING, COMMITTED_VOTE_SEED, VOTE_ROUND_SEED},
    errors::OpalError,
    state::{AssertionAccount, CommittedVote, VoteResolutionRound},
    utils::{is_outcome_set, is_timestamp_set, validate_outcome_code},
};
use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};

/// Arguments for the `reveal_vote` instruction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RevealVoteArgs {
    pub outcome: u8,
    pub salt: [u8; 32],
}

/// Accounts for the `reveal_vote` instruction.
#[derive(Accounts)]
pub struct RevealVote<'info> {
    pub voter: Signer<'info>,

    #[account(
        seeds = [ASSERTION_SEED, assertion.load()?.id.as_ref()],
        bump = assertion.load()?.bump,
    )]
    pub assertion: AccountLoader<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [VOTE_ROUND_SEED, assertion.key().as_ref()],
        bump = vote_resolution_round.load()?.bump,
    )]
    pub vote_resolution_round: AccountLoader<'info, VoteResolutionRound>,

    #[account(
        mut,
        seeds = [COMMITTED_VOTE_SEED, vote_resolution_round.key().as_ref(), voter.key().as_ref()],
        bump = committed_vote.load()?.bump,
    )]
    pub committed_vote: AccountLoader<'info, CommittedVote>,
}

/// Reveals a committed vote: verifies the hash and tallies the weight into the round.
pub fn handler(ctx: Context<RevealVote>, args: RevealVoteArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let assertion = ctx.accounts.assertion.load()?;
    let vote_round = ctx.accounts.vote_resolution_round.load()?;
    let committed_vote = ctx.accounts.committed_vote.load()?;

    require!(
        assertion.state == ASSERTION_STATE_VOTING,
        OpalError::InvalidState
    );
    require!(
        vote_round.assertion == ctx.accounts.assertion.key(),
        OpalError::AssertionLinkMismatch
    );
    require!(
        committed_vote.vote_round == ctx.accounts.vote_resolution_round.key(),
        OpalError::RoundLinkMismatch
    );
    require!(
        committed_vote.voter == ctx.accounts.voter.key(),
        OpalError::Unauthorized
    );
    // Reveal window: voting_deadline ≤ now < reveal_deadline
    require!(
        is_timestamp_set(vote_round.voting_deadline) && now >= vote_round.voting_deadline,
        OpalError::RevealWindowNotOpen
    );
    require!(
        is_timestamp_set(vote_round.reveal_deadline) && now < vote_round.reveal_deadline,
        OpalError::RevealWindowClosed
    );
    require!(
        !is_outcome_set(committed_vote.revealed_outcome),
        OpalError::AlreadySettled
    );

    let outcome = validate_outcome_code(args.outcome)?;

    // Verify: sha256(outcome || salt || voter_pubkey) must match the stored commitment
    let mut hasher = Sha256::new();
    hasher.update([outcome]);
    hasher.update(args.salt);
    hasher.update(ctx.accounts.voter.key().as_ref());
    let computed: [u8; 32] = hasher.finalize().into();
    require!(
        computed == committed_vote.commitment,
        OpalError::InvalidVoteCommitment
    );

    let weight = committed_vote.weight as u128;
    drop(committed_vote);
    drop(vote_round);
    drop(assertion);

    let vote_round = &mut ctx.accounts.vote_resolution_round.load_mut()?;
    match outcome {
        0 => {
            vote_round.aggregate_votes.true_weight = vote_round
                .aggregate_votes
                .true_weight
                .checked_add(weight)
                .ok_or(OpalError::MathOverflow)?;
        }
        1 => {
            vote_round.aggregate_votes.false_weight = vote_round
                .aggregate_votes
                .false_weight
                .checked_add(weight)
                .ok_or(OpalError::MathOverflow)?;
        }
        2 => {
            vote_round.aggregate_votes.too_early_weight = vote_round
                .aggregate_votes
                .too_early_weight
                .checked_add(weight)
                .ok_or(OpalError::MathOverflow)?;
        }
        _ => {
            vote_round.aggregate_votes.unresolvable_weight = vote_round
                .aggregate_votes
                .unresolvable_weight
                .checked_add(weight)
                .ok_or(OpalError::MathOverflow)?;
        }
    }
    vote_round.total_valid_weight = vote_round
        .total_valid_weight
        .checked_add(weight)
        .ok_or(OpalError::MathOverflow)?;

    let mut committed_vote = ctx.accounts.committed_vote.load_mut()?;
    committed_vote.revealed_outcome = outcome;

    Ok(())
}
