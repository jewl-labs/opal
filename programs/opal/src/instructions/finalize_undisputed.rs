use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_ASSERTED, ASSERTION_STATE_RESOLVED, BOND_VAULT_SEED,
        OUTCOME_TRUE, PROTOCOL_CONFIG_SEED,
    },
    errors::OpalError,
    settlement::{settle, PayoutAccounts, Positions, Settlement},
    state::{AssertionAccount, ProtocolConfig},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

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

    pub usdc_mint: Account<'info, Mint>,

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
        token::mint = usdc_mint,
        token::authority = assertion,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub asserter_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub treasury_usdc: Account<'info, TokenAccount>,

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

    let positions = Positions {
        asserter: assertion.asserter,
        asserter_bond: assertion.assertion_bond_amount_usdc,
        llm_disputer: None,
    };
    let fee_bps = protocol_config.protocol_fee_bps;
    let treasury = protocol_config.treasury;
    let assertion_id = assertion.id;
    let bump = assertion.bump;
    drop(assertion);
    drop(protocol_config);

    let signer_seeds: &[&[u8]] = &[ASSERTION_SEED, assertion_id.as_ref(), &[bump]];
    settle(
        Settlement::Undisputed,
        &positions,
        fee_bps,
        treasury,
        PayoutAccounts {
            bond_vault: &ctx.accounts.bond_vault,
            assertion: ctx.accounts.assertion.as_ref(),
            asserter_usdc: &ctx.accounts.asserter_usdc,
            llm_disputer_usdc: None,
            treasury_usdc: &ctx.accounts.treasury_usdc,
        },
        signer_seeds,
    )?;

    let mut assertion = ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_RESOLVED;
    assertion.outcome = OUTCOME_TRUE;
    assertion.finalized_at = now;

    Ok(())
}
