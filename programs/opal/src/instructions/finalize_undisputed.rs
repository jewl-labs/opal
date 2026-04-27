use crate::{
    constants::{ASSERTION_SEED, BOND_VAULT_SEED, PROTOCOL_CONFIG_SEED},
    errors::OpalError,
    state::{AssertionAccount, AssertionState, ProtocolConfig, ResolutionOutcome},
    utils::checked_bps,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct FinalizeUndisputed<'info> {
    pub finalizer: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump,
        has_one = pusd_mint @ OpalError::InvalidPusdMint,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    pub pusd_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [ASSERTION_SEED, assertion.id.as_ref()],
        bump = assertion.bump,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, assertion.id.as_ref()],
        bump,
        token::mint = pusd_mint,
        token::authority = assertion,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pusd_mint,
        constraint = asserter_pusd.owner == assertion.asserter @ OpalError::InvalidAsserterTokenAccount,
    )]
    pub asserter_pusd: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = protocol_config.treasury @ OpalError::InvalidTreasuryAccount,
        token::mint = pusd_mint,
    )]
    pub treasury_pusd: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FinalizeUndisputed>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        ctx.accounts.assertion.state == AssertionState::Asserted,
        OpalError::InvalidState
    );
    require!(
        ctx.accounts.assertion.dispute_count == 0,
        OpalError::AssertionAlreadyDisputed
    );
    require!(
        now >= ctx.accounts.assertion.liveness_deadline,
        OpalError::DeadlineNotReached
    );

    let assertion_bond = ctx.accounts.assertion.assertion_bond_amount_pusd;
    require!(
        ctx.accounts.bond_vault.amount >= assertion_bond,
        OpalError::InsufficientVaultBalance
    );

    let fee = checked_bps(assertion_bond, ctx.accounts.protocol_config.protocol_fee_bps)?;
    let asserter_payout = assertion_bond
        .checked_sub(fee)
        .ok_or(OpalError::MathOverflow)?;

    let assertion_id = ctx.accounts.assertion.id;
    let bump = [ctx.accounts.assertion.bump];
    let signer_seeds: &[&[u8]] = &[ASSERTION_SEED, assertion_id.as_ref(), &bump];

    if asserter_payout > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bond_vault.to_account_info(),
                    to: ctx.accounts.asserter_pusd.to_account_info(),
                    authority: ctx.accounts.assertion.to_account_info(),
                },
                &[signer_seeds],
            ),
            asserter_payout,
        )?;
    }

    if fee > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bond_vault.to_account_info(),
                    to: ctx.accounts.treasury_pusd.to_account_info(),
                    authority: ctx.accounts.assertion.to_account_info(),
                },
                &[signer_seeds],
            ),
            fee,
        )?;
    }

    let assertion = &mut ctx.accounts.assertion;
    assertion.state = AssertionState::Resolved;
    assertion.outcome = Some(ResolutionOutcome::True);
    assertion.finalized_at = Some(now);

    Ok(())
}
