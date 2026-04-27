use crate::{
    constants::{
        ASSERTION_SEED, BOND_VAULT_SEED, MAX_AUXILIARY_HASH_LEN, MAX_STATEMENT_LEN,
        PROTOCOL_CONFIG_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, AssertionState, ProtocolConfig},
    utils::checked_add_i64,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreateAssertionArgs {
    pub assertion_id: Pubkey,
    pub statement: String,
    pub auxiliary_hash: String,
    pub assertion_bond_amount_pusd: u64,
}

#[derive(Accounts)]
#[instruction(args: CreateAssertionArgs)]
pub struct CreateAssertion<'info> {
    #[account(mut)]
    pub asserter: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump,
        has_one = pusd_mint @ OpalError::InvalidPusdMint,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    pub pusd_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = asserter,
        space = 8 + AssertionAccount::INIT_SPACE,
        seeds = [ASSERTION_SEED, args.assertion_id.as_ref()],
        bump
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        init,
        payer = asserter,
        token::mint = pusd_mint,
        token::authority = assertion,
        seeds = [BOND_VAULT_SEED, args.assertion_id.as_ref()],
        bump
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pusd_mint,
        token::authority = asserter,
    )]
    pub asserter_pusd: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateAssertion>, args: CreateAssertionArgs) -> Result<()> {
    require!(
        args.statement.as_bytes().len() <= MAX_STATEMENT_LEN,
        OpalError::StatementTooLong
    );
    require!(
        args.auxiliary_hash.as_bytes().len() <= MAX_AUXILIARY_HASH_LEN,
        OpalError::AuxiliaryHashTooLong
    );
    require!(
        args.assertion_bond_amount_pusd >= ctx.accounts.protocol_config.assertion_bond_min_pusd,
        OpalError::InsufficientBondAmount
    );

    let now = Clock::get()?.unix_timestamp;
    let liveness_deadline = checked_add_i64(now, ctx.accounts.protocol_config.liveness_window_seconds)?;

    let assertion = &mut ctx.accounts.assertion;
    assertion.set_inner(AssertionAccount {
        id: args.assertion_id,
        asserter: ctx.accounts.asserter.key(),
        statement: args.statement,
        auxiliary_hash: args.auxiliary_hash,
        bond_vault: ctx.accounts.bond_vault.key(),
        state: AssertionState::Asserted,
        liveness_deadline,
        llm_challenge_deadline: None,
        outcome: None,
        finalized_at: None,
        dispute_count: 0,
        assertion_bond_amount_pusd: args.assertion_bond_amount_pusd,
        llm_dispute: None,
        vote_dispute: None,
        llm_resolution_round: None,
        vote_resolution_round: None,
        bump: ctx.bumps.assertion,
    });

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.asserter_pusd.to_account_info(),
                to: ctx.accounts.bond_vault.to_account_info(),
                authority: ctx.accounts.asserter.to_account_info(),
            },
        ),
        args.assertion_bond_amount_pusd,
    )?;

    Ok(())
}
