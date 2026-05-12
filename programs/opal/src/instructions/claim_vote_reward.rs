use crate::{
    constants::{
        ASSERTION_SEED, BOOL_TRUE, BOND_VAULT_SEED, VOTE_RECORD_SEED, VOTE_ROUND_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, VoteRecord, VoteResolutionRound},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct ClaimVoteReward<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    pub pusd_mint: Account<'info, Mint>,

    #[account(
        seeds = [ASSERTION_SEED, assertion.load()?.id.as_ref()],
        bump = assertion.load()?.bump,
    )]
    pub assertion: AccountLoader<'info, AssertionAccount>,

    #[account(
        seeds = [VOTE_ROUND_SEED, assertion.key().as_ref()],
        bump = vote_resolution_round.load()?.bump,
        constraint = vote_resolution_round.load()?.assertion == assertion.key() @ OpalError::AssertionLinkMismatch,
    )]
    pub vote_resolution_round: AccountLoader<'info, VoteResolutionRound>,

    #[account(
        mut,
        seeds = [VOTE_RECORD_SEED, vote_resolution_round.key().as_ref(), voter.key().as_ref()],
        bump = vote_record.load()?.bump,
        constraint = vote_record.load()?.voter == voter.key() @ OpalError::Unauthorized,
        constraint = vote_record.load()?.vote_round == vote_resolution_round.key() @ OpalError::RoundLinkMismatch,
        close = voter,
    )]
    pub vote_record: AccountLoader<'info, VoteRecord>,

    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, assertion.load()?.id.as_ref()],
        bump,
        token::mint = pusd_mint,
        token::authority = assertion,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pusd_mint,
        token::authority = voter,
    )]
    pub voter_pusd: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimVoteReward>) -> Result<()> {
    let vote_round = ctx.accounts.vote_resolution_round.load()?;
    let record = ctx.accounts.vote_record.load()?;

    // Round must be finalized (committed flag set by finalize_vote_resolution).
    require!(vote_round.committed == BOOL_TRUE, OpalError::VoteRoundNotFinalized);
    require!(record.revealed == BOOL_TRUE, OpalError::AlreadyCommitted); // unrevealed = no reward
    require!(record.reward_claimed == 0, OpalError::RewardAlreadyClaimed);
    require!(
        record.outcome == vote_round.final_outcome,
        OpalError::NotWinningVoter
    );

    let voter_reward_pool = vote_round.voter_reward_pool;
    require!(voter_reward_pool > 0, OpalError::InsufficientBondAmount);

    // Determine total weight on the winning side to calculate proportional share.
    let winning_weight = match vote_round.final_outcome {
        0 => vote_round.aggregate_votes.true_weight,
        1 => vote_round.aggregate_votes.false_weight,
        2 => vote_round.aggregate_votes.too_early_weight,
        _ => vote_round.aggregate_votes.unresolvable_weight,
    };
    require!(winning_weight > 0, OpalError::QuorumNotMet);

    // reward = voter_reward_pool × voter_weight / total_winning_weight
    let voter_weight = record.opal_weight as u128;
    let reward = (voter_reward_pool as u128)
        .checked_mul(voter_weight)
        .ok_or(OpalError::MathOverflow)?
        .checked_div(winning_weight)
        .ok_or(OpalError::MathOverflow)?;
    let reward = u64::try_from(reward).map_err(|_| error!(OpalError::MathOverflow))?;

    let assertion_id = ctx.accounts.assertion.load()?.id;
    let bump = ctx.accounts.assertion.load()?.bump;
    drop(vote_round);
    drop(record);

    if reward > 0 {
        let signer_seeds: &[&[u8]] = &[ASSERTION_SEED, assertion_id.as_ref(), &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bond_vault.to_account_info(),
                    to: ctx.accounts.voter_pusd.to_account_info(),
                    authority: ctx.accounts.assertion.to_account_info(),
                },
                &[signer_seeds],
            ),
            reward,
        )?;
    }

    // Mark claimed — account is closed via `close = voter` constraint, rent refunded.
    let mut record = ctx.accounts.vote_record.load_mut()?;
    record.reward_claimed = BOOL_TRUE;

    Ok(())
}
