// Commits the final ER vote state back to L1 and releases the VoteResolutionRound
// account from MagicBlock delegation.
//
// This instruction MUST run on the MagicBlock Ephemeral Rollup (ER), not on L1.
// The ER validator provides `buffer` as a signer; `undelegate_account` copies the
// accumulated vote tallies from the buffer back to the L1 PDA and reassigns ownership
// to the opal program so `finalize_vote_resolution` can write to it on L1.
//
// Typical flow:
//   1. open_vote (L1)              — delegates VoteResolutionRound to ER
//   2. cast_vote / reveal_vote (ER) — accumulate tallies in ER state
//   3. undelegate_vote_round (ER)  — commits ER state to L1, releases account ← this
//   4. finalize_vote_resolution (L1)— reads committed tallies, settles bonds

use crate::{
    constants::{ASSERTION_SEED, ASSERTION_STATE_VOTING, VOTE_ROUND_SEED},
    errors::OpalError,
    state::AssertionAccount,
};
use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::cpi::undelegate_account;

#[derive(Accounts)]
pub struct UndelegateVoteRound<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [ASSERTION_SEED, assertion.load()?.id.as_ref()],
        bump = assertion.load()?.bump,
    )]
    pub assertion: AccountLoader<'info, AssertionAccount>,

    /// The VoteResolutionRound PDA being undelegated.
    /// While delegated its owner is the MagicBlock delegation program, so Anchor
    /// owner/discriminator checks are skipped here.  Seeds are still verified.
    ///
    /// CHECK: owned by delegation program while delegated; seeds validated below
    #[account(
        mut,
        seeds = [VOTE_ROUND_SEED, assertion.key().as_ref()],
        bump,
    )]
    pub vote_resolution_round: AccountInfo<'info>,

    /// The ER buffer PDA — holds the accumulated vote state.
    /// Must be signed by the ER validator (only callable from the ER).
    ///
    /// CHECK: buffer PDA created by delegation program; must be a signer (ER-only)
    #[account(mut)]
    pub buffer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<UndelegateVoteRound>) -> Result<()> {
    // Assert must still be in VOTING state — if it were already RESOLVED someone
    // called finalize_vote_resolution before undelegating, which shouldn't happen.
    // The reveal_deadline timing gate lives in finalize_vote_resolution on L1.
    let assertion = ctx.accounts.assertion.load()?;
    require!(
        assertion.state == ASSERTION_STATE_VOTING,
        OpalError::InvalidState
    );
    drop(assertion);

    let assertion_key = ctx.accounts.assertion.key();

    // Seeds WITHOUT bump — undelegate_account calls find_program_address internally.
    let seeds: Vec<Vec<u8>> = vec![
        VOTE_ROUND_SEED.to_vec(),
        assertion_key.to_bytes().to_vec(),
    ];

    undelegate_account(
        &ctx.accounts.vote_resolution_round.to_account_info(),
        &crate::ID,
        &ctx.accounts.buffer.to_account_info(),
        &ctx.accounts.payer.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        seeds,
    )
    .map_err(|_| error!(OpalError::UndelegationFailed))?;

    Ok(())
}
