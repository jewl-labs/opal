use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_PENDING_VOTE, ASSERTION_STATE_VOTING, BOOL_TRUE,
        PROTOCOL_CONFIG_SEED, VOTE_ROUND_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, ProtocolConfig, VoteResolutionRound},
    utils::checked_add_i64,
};
use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::cpi::{delegate_account, DelegateAccounts, DelegateConfig};

#[derive(Accounts)]
pub struct OpenVote<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,

    #[account(
        mut,
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

    // ── MagicBlock delegation accounts ──

    /// CHECK: the opal program account (owner of the PDA being delegated)
    #[account(address = crate::ID)]
    pub owner_program: AccountInfo<'info>,

    /// CHECK: buffer PDA derived by the delegation program
    #[account(mut)]
    pub buffer: AccountInfo<'info>,

    /// CHECK: delegation record PDA derived by the delegation program
    #[account(mut)]
    pub delegation_record: AccountInfo<'info>,

    /// CHECK: delegation metadata PDA derived by the delegation program
    #[account(mut)]
    pub delegation_metadata: AccountInfo<'info>,

    /// CHECK: MagicBlock delegation program
    pub delegation_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<OpenVote>) -> Result<()> {
    // TBD: auth policy for open_vote is undecided. Currently permissionless for liveness.
    let assertion = ctx.accounts.assertion.load()?;
    let vote_round = ctx.accounts.vote_resolution_round.load()?;
    require!(
        assertion.state == ASSERTION_STATE_PENDING_VOTE,
        OpalError::InvalidState
    );
    require!(
        vote_round.assertion == ctx.accounts.assertion.key(),
        OpalError::AssertionLinkMismatch
    );
    drop(assertion);
    drop(vote_round);

    let now = Clock::get()?.unix_timestamp;
    let protocol_config = ctx.accounts.protocol_config.load()?;
    let voting_starts_at = checked_add_i64(now, protocol_config.vote_setup_window_seconds)?;
    let voting_deadline = checked_add_i64(voting_starts_at, protocol_config.voting_window_seconds)?;
    // Reveal window opens after commit window closes — separate windows for commit-reveal scheme.
    let reveal_deadline = checked_add_i64(voting_deadline, protocol_config.reveal_window_seconds)?;
    drop(protocol_config);

    // Delegate VoteResolutionRound to MagicBlock ER so cast_vote/reveal_vote can run on the ER.
    let assertion_key = ctx.accounts.assertion.key();
    let pda_seeds: &[&[u8]] = &[VOTE_ROUND_SEED, assertion_key.as_ref()];

    delegate_account(
        DelegateAccounts {
            payer: &ctx.accounts.authority.to_account_info(),
            pda: &ctx.accounts.vote_resolution_round.to_account_info(),
            owner_program: &ctx.accounts.owner_program.to_account_info(),
            buffer: &ctx.accounts.buffer.to_account_info(),
            delegation_record: &ctx.accounts.delegation_record.to_account_info(),
            delegation_metadata: &ctx.accounts.delegation_metadata.to_account_info(),
            delegation_program: &ctx.accounts.delegation_program.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
        },
        pda_seeds,
        DelegateConfig {
            // Periodic commit every minute so state is available on L1 during reveal window.
            commit_frequency_ms: 60_000,
            validator: None,
        },
    )?;

    let vote_round = &mut ctx.accounts.vote_resolution_round.load_mut()?;
    vote_round.voting_starts_at = voting_starts_at;
    vote_round.voting_deadline = voting_deadline;
    vote_round.reveal_deadline = reveal_deadline;
    vote_round.delegated = BOOL_TRUE;

    let assertion = &mut ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_VOTING;

    Ok(())
}
