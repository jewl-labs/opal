use crate::{
    constants::{
        ASSERTION_SEED, BOOL_TRUE, COMMITTED_VOTE_SEED, OUTCOME_NONE, VOTE_ROUND_SEED,
        VOTE_VAULT_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, CommittedVote, VoteResolutionRound},
    utils::is_outcome_set,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

/// Accounts for the `claim_vote_reward` instruction.
#[derive(Accounts)]
pub struct ClaimVoteReward<'info> {
    pub voter: Signer<'info>,

    #[account(
        seeds = [ASSERTION_SEED, assertion.load()?.id.as_ref()],
        bump = assertion.load()?.bump,
    )]
    pub assertion: AccountLoader<'info, AssertionAccount>,

    #[account(
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

    #[account(
        mut,
        seeds = [VOTE_VAULT_SEED, vote_resolution_round.key().as_ref()],
        bump,
        token::mint = pusd_mint,
        token::authority = vote_resolution_round,
    )]
    pub vote_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pusd_mint,
        token::authority = voter,
    )]
    pub voter_pusd: Account<'info, TokenAccount>,

    pub pusd_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

/// Claims a majority voter's original bond plus their proportional reward share.
pub fn handler(ctx: Context<ClaimVoteReward>) -> Result<()> {
    let vote_round = ctx.accounts.vote_resolution_round.load()?;
    let committed_vote = ctx.accounts.committed_vote.load()?;

    // Round must be finalized
    require!(
        is_outcome_set(vote_round.final_outcome),
        OpalError::VoteNotFinalized
    );
    require!(
        vote_round.final_outcome != OUTCOME_NONE,
        OpalError::VoteNotFinalized
    );
    require!(committed_vote.claimed == 0, OpalError::VoteRewardAlreadyClaimed);
    require!(
        committed_vote.vote_round == ctx.accounts.vote_resolution_round.key(),
        OpalError::RoundLinkMismatch
    );
    require!(
        committed_vote.voter == ctx.accounts.voter.key(),
        OpalError::Unauthorized
    );
    // Voter must have revealed and voted with the majority
    require!(
        is_outcome_set(committed_vote.revealed_outcome),
        OpalError::VoteNotRevealed
    );
    require!(
        committed_vote.revealed_outcome == vote_round.final_outcome,
        OpalError::VoterNotMajority
    );

    let voter_weight = committed_vote.weight as u128;
    let voter_reward_pool = vote_round.voter_reward_pool;
    let final_outcome = vote_round.final_outcome;
    let vote_round_bump = vote_round.bump;

    // majority_bond = aggregate_votes[winning_outcome]
    let majority_bond = match final_outcome {
        0 => vote_round.aggregate_votes.true_weight,
        1 => vote_round.aggregate_votes.false_weight,
        2 => vote_round.aggregate_votes.too_early_weight,
        _ => vote_round.aggregate_votes.unresolvable_weight,
    };
    drop(vote_round);
    drop(committed_vote);

    // voter_reward = (voter_weight / majority_bond) * voter_reward_pool
    let voter_reward = if majority_bond > 0 && voter_reward_pool > 0 {
        let reward_128 = voter_weight
            .checked_mul(voter_reward_pool)
            .ok_or(OpalError::MathOverflow)?
            .checked_div(majority_bond)
            .ok_or(OpalError::MathOverflow)?;
        u64::try_from(reward_128).map_err(|_| error!(OpalError::MathOverflow))?
    } else {
        0u64
    };

    let voter_weight_u64 =
        u64::try_from(voter_weight).map_err(|_| error!(OpalError::MathOverflow))?;
    let total_payout = voter_weight_u64
        .checked_add(voter_reward)
        .ok_or(OpalError::MathOverflow)?;

    let assertion_key = ctx.accounts.assertion.key();
    let signer_seeds: &[&[u8]] = &[VOTE_ROUND_SEED, assertion_key.as_ref(), &[vote_round_bump]];

    if total_payout > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vote_vault.to_account_info(),
                    to: ctx.accounts.voter_pusd.to_account_info(),
                    authority: ctx.accounts.vote_resolution_round.to_account_info(),
                },
                &[signer_seeds],
            ),
            total_payout,
        )?;
    }

    let mut committed_vote = ctx.accounts.committed_vote.load_mut()?;
    committed_vote.claimed = BOOL_TRUE;

    Ok(())
}
