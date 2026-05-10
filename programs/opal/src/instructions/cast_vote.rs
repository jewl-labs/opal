use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_VOTING, BOOL_FALSE, COMMITTED_VOTE_SEED, OUTCOME_NONE,
        VOTE_ROUND_SEED, VOTE_VAULT_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, CommittedVote, VoteResolutionRound},
    utils::is_timestamp_set,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

/// Arguments for the `cast_vote` instruction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CastVoteArgs {
    /// sha256(outcome_byte || salt_32_bytes || voter_pubkey_bytes)
    pub commitment: [u8; 32],
    /// PUSD bond to lock; doubles as the vote weight.
    pub bond_amount: u64,
}

/// Accounts for the `cast_vote` instruction.
#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
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
        init,
        payer = voter,
        space = 8 + std::mem::size_of::<CommittedVote>(),
        seeds = [COMMITTED_VOTE_SEED, vote_resolution_round.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub committed_vote: AccountLoader<'info, CommittedVote>,

    #[account(
        mut,
        seeds = [VOTE_VAULT_SEED, vote_resolution_round.key().as_ref()],
        bump,
        token::mint = pusd_mint,
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
    pub system_program: Program<'info, System>,
}

/// Commits a hashed vote and locks a PUSD bond in the vote vault.
pub fn handler(ctx: Context<CastVote>, args: CastVoteArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let assertion = ctx.accounts.assertion.load()?;
    let vote_round = ctx.accounts.vote_resolution_round.load()?;

    require!(
        assertion.state == ASSERTION_STATE_VOTING,
        OpalError::InvalidState
    );
    require!(
        vote_round.assertion == ctx.accounts.assertion.key(),
        OpalError::AssertionLinkMismatch
    );
    require!(
        is_timestamp_set(vote_round.voting_starts_at) && now >= vote_round.voting_starts_at,
        OpalError::VoteWindowNotOpen
    );
    require!(
        is_timestamp_set(vote_round.voting_deadline) && now < vote_round.voting_deadline,
        OpalError::DeadlinePassed
    );
    require!(args.bond_amount > 0, OpalError::InsufficientBondAmount);
    drop(assertion);
    drop(vote_round);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.voter_pusd.to_account_info(),
                to: ctx.accounts.vote_vault.to_account_info(),
                authority: ctx.accounts.voter.to_account_info(),
            },
        ),
        args.bond_amount,
    )?;

    let vote_round = &mut ctx.accounts.vote_resolution_round.load_mut()?;
    vote_round.total_vote_bond = vote_round
        .total_vote_bond
        .checked_add(args.bond_amount as u128)
        .ok_or(OpalError::MathOverflow)?;

    let mut committed_vote = ctx.accounts.committed_vote.load_init()?;
    committed_vote.vote_round = ctx.accounts.vote_resolution_round.key();
    committed_vote.voter = ctx.accounts.voter.key();
    committed_vote.commitment = args.commitment;
    committed_vote.revealed_outcome = OUTCOME_NONE;
    committed_vote.weight = args.bond_amount;
    committed_vote.claimed = BOOL_FALSE;
    committed_vote.created_at = now;
    committed_vote.bump = ctx.bumps.committed_vote;

    Ok(())
}
