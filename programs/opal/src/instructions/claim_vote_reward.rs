use crate::{
    constants::{
        ASSERTION_SEED, BOOL_TRUE, BOND_VAULT_SEED, OPAL_ESCROW_SEED, VOTE_RECORD_SEED,
        VOTE_ROUND_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, VoteRecord, VoteResolutionRound},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct ClaimVoteReward<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    pub opal_mint: Box<Account<'info, Mint>>,

    pub pusd_mint: Box<Account<'info, Mint>>,

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

    /// Voter's OPAL account that receives the escrowed tokens back.
    #[account(
        mut,
        token::mint = opal_mint,
        token::authority = voter,
    )]
    pub voter_opal: Box<Account<'info, TokenAccount>>,

    /// Escrow holding voter's OPAL — returned here and closed.
    #[account(
        mut,
        seeds = [OPAL_ESCROW_SEED, vote_resolution_round.key().as_ref(), voter.key().as_ref()],
        bump,
        token::mint = opal_mint,
        token::authority = vote_record,
    )]
    pub opal_escrow: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, assertion.load()?.id.as_ref()],
        bump,
        token::mint = pusd_mint,
        token::authority = assertion,
    )]
    pub bond_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = pusd_mint,
        token::authority = voter,
    )]
    pub voter_pusd: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimVoteReward>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let vote_round = ctx.accounts.vote_resolution_round.load()?;
    let record = ctx.accounts.vote_record.load()?;

    // Allow claim once the round is finalized OR the reveal window has closed.
    // This lets voters recover escrowed OPAL even when finalization fails (e.g. quorum not met).
    require!(
        vote_round.committed == BOOL_TRUE || now > vote_round.reveal_deadline,
        OpalError::VoteRoundNotFinalized,
    );
    require!(record.reward_claimed == 0, OpalError::RewardAlreadyClaimed);

    // PUSD reward only available when the round was properly finalized.
    let is_winner = vote_round.committed == BOOL_TRUE
        && record.revealed == BOOL_TRUE
        && record.outcome == vote_round.final_outcome;

    let opal_weight = record.opal_weight;
    let vote_record_bump = record.bump;
    let voter_reward_pool = vote_round.voter_reward_pool;

    let winning_weight = match vote_round.final_outcome {
        0 => vote_round.aggregate_votes.true_weight,
        1 => vote_round.aggregate_votes.false_weight,
        2 => vote_round.aggregate_votes.too_early_weight,
        _ => vote_round.aggregate_votes.unresolvable_weight,
    };

    let assertion_ref = ctx.accounts.assertion.load()?;
    let assertion_id = assertion_ref.id;
    let assertion_bump = assertion_ref.bump;
    drop(assertion_ref);
    drop(vote_round);
    drop(record);

    // Signer seeds for the vote_record PDA (authority over opal_escrow).
    let vr_key = ctx.accounts.vote_resolution_round.key();
    let voter_key = ctx.accounts.voter.key();
    let bump_bytes = [vote_record_bump];
    let record_signer_seeds: &[&[&[u8]]] = &[&[
        VOTE_RECORD_SEED,
        vr_key.as_ref(),
        voter_key.as_ref(),
        &bump_bytes,
    ]];

    // Return the full OPAL balance to the voter regardless of outcome.
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.opal_escrow.to_account_info(),
                to: ctx.accounts.voter_opal.to_account_info(),
                authority: ctx.accounts.vote_record.to_account_info(),
            },
            record_signer_seeds,
        ),
        opal_weight,
    )?;

    // Close the OPAL escrow — rent lamports go back to voter.
    token::close_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.opal_escrow.to_account_info(),
                destination: ctx.accounts.voter.to_account_info(),
                authority: ctx.accounts.vote_record.to_account_info(),
            },
            record_signer_seeds,
        ),
    )?;

    // PUSD reward only for voters who revealed and landed on the winning outcome.
    if is_winner && voter_reward_pool > 0 && winning_weight > 0 {
        let reward = (voter_reward_pool as u128)
            .checked_mul(opal_weight as u128)
            .ok_or(OpalError::MathOverflow)?
            .checked_div(winning_weight)
            .ok_or(OpalError::MathOverflow)?;
        let reward = u64::try_from(reward).map_err(|_| error!(OpalError::MathOverflow))?;

        if reward > 0 {
            let signer_seeds: &[&[u8]] =
                &[ASSERTION_SEED, assertion_id.as_ref(), &[assertion_bump]];
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
    }

    let mut record = ctx.accounts.vote_record.load_mut()?;
    record.reward_claimed = BOOL_TRUE;

    Ok(())
}
