use crate::{
    constants::{
        BOOL_FALSE, BOOL_TRUE, OUTCOME_NONE, PROTOCOL_CONFIG_SEED,
        VOTE_RECORD_SEED, VOTE_ROUND_SEED,
    },
    errors::OpalError,
    state::{ProtocolConfig, VoteRecord, VoteResolutionRound},
    utils::is_timestamp_set,
};
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CastVoteArgs {
    /// SHA-256(outcome_byte || nonce): hides the vote until reveal phase
    pub commit_hash: [u8; 32],
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,

    #[account(
        seeds = [VOTE_ROUND_SEED, vote_resolution_round.load()?.assertion.as_ref()],
        bump = vote_resolution_round.load()?.bump,
    )]
    pub vote_resolution_round: AccountLoader<'info, VoteResolutionRound>,

    #[account(
        init,
        payer = voter,
        space = 8 + std::mem::size_of::<VoteRecord>(),
        seeds = [VOTE_RECORD_SEED, vote_resolution_round.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub vote_record: AccountLoader<'info, VoteRecord>,

    /// Voter's OPAL token account — balance is snapshotted as voting weight.
    #[account(
        token::mint = protocol_config.load()?.opal_mint,
        token::authority = voter,
    )]
    pub voter_opal: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CastVote>, args: CastVoteArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let protocol_config = ctx.accounts.protocol_config.load()?;
    let vote_round = ctx.accounts.vote_resolution_round.load()?;

    let assertion = vote_round.assertion;

    require!(
        vote_round.delegated == BOOL_TRUE,
        OpalError::VoteNotOpen
    );
    require!(
        is_timestamp_set(vote_round.voting_starts_at),
        OpalError::VoteNotOpen
    );
    require!(
        now >= vote_round.voting_starts_at,
        OpalError::VoteNotOpen
    );
    require!(
        now < vote_round.voting_deadline,
        OpalError::CommitWindowClosed
    );
    let _ = assertion;
    drop(vote_round);
    drop(protocol_config);

    let opal_weight = ctx.accounts.voter_opal.amount;
    require!(opal_weight > 0, OpalError::InsufficientBondAmount);

    let mut record = ctx.accounts.vote_record.load_init()?;
    record.voter = ctx.accounts.voter.key();
    record.vote_round = ctx.accounts.vote_resolution_round.key();
    record.commit_hash = args.commit_hash;
    record.opal_weight = opal_weight;
    record.committed_at = now;
    record.outcome = OUTCOME_NONE;
    record.revealed = BOOL_FALSE;
    record.reward_claimed = BOOL_FALSE;
    record.bump = ctx.bumps.vote_record;
    record.nonce = [0u8; 32];

    Ok(())
}
