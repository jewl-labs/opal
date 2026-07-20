use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_ASSERTED, ASSERTION_STATE_RESOLVED, BOND_VAULT_SEED,
        OUTCOME_TRUE, PROTOCOL_CONFIG_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, ProtocolConfig},
    utils::checked_bps,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FinalizeUndisputedArgs {
    pub assertion_id: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: FinalizeUndisputedArgs)]
pub struct FinalizeUndisputed<'info> {
    pub finalizer: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,

    pub pusd_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [ASSERTION_SEED, args.assertion_id.as_ref()],
        bump = assertion.load()?.bump,
    )]
    pub assertion: AccountLoader<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, args.assertion_id.as_ref()],
        bump,
        token::mint = pusd_mint,
        token::authority = assertion,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pusd_mint,
    )]
    pub asserter_pusd: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pusd_mint,
    )]
    pub treasury_pusd: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FinalizeUndisputed>, _args: FinalizeUndisputedArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let assertion = ctx.accounts.assertion.load()?;
    let protocol_config = ctx.accounts.protocol_config.load()?;

    require!(
        assertion.state == ASSERTION_STATE_ASSERTED,
        OpalError::InvalidState
    );
    require!(
        assertion.dispute_count == 0,
        OpalError::AssertionAlreadyDisputed
    );
    require!(
        now >= assertion.liveness_deadline,
        OpalError::DeadlineNotReached
    );
    require!(
        ctx.accounts.bond_vault.amount >= assertion.assertion_bond_amount_pusd,
        OpalError::InsufficientVaultBalance
    );
    require!(
        ctx.accounts.asserter_pusd.owner == assertion.asserter,
        OpalError::InvalidAsserterTokenAccount
    );
    require!(
        ctx.accounts.treasury_pusd.key() == protocol_config.treasury,
        OpalError::InvalidTreasuryAccount
    );

    let assertion_bond = assertion.assertion_bond_amount_pusd;
    let fee = checked_bps(assertion_bond, protocol_config.protocol_fee_bps)?;
    let asserter_payout = assertion_bond
        .checked_sub(fee)
        .ok_or(OpalError::MathOverflow)?;

    let assertion_id = assertion.id;
    let bump = assertion.bump;
    drop(assertion);

    let signer_seeds: &[&[u8]] = &[ASSERTION_SEED, assertion_id.as_ref(), &[bump]];

    if asserter_payout > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                Token::id(),
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
                Token::id(),
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

    let mut assertion = ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_RESOLVED;
    assertion.outcome = OUTCOME_TRUE;
    assertion.finalized_at = now;

    Ok(())
}
