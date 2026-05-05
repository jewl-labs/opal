use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_ASSERTED, BOND_VAULT_SEED, MAX_AUXILIARY_HASH_LEN,
        MAX_STATEMENT_LEN, OUTCOME_NONE, PROTOCOL_CONFIG_SEED, TIMESTAMP_NONE,
    },
    errors::OpalError,
    state::{AssertionAccount, ProtocolConfig},
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
        bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,

    pub pusd_mint: Account<'info, Mint>,

    // !TBD: assertion_id is caller-supplied, allowing front-running of the assertion PDA.
    // Consider using a hash of (asserter, nonce) to prevent this.
    #[account(
        init,
        payer = asserter,
        space = 8 + std::mem::size_of::<AssertionAccount>(),
        seeds = [ASSERTION_SEED, args.assertion_id.as_ref()],
        bump
    )]
    pub assertion: AccountLoader<'info, AssertionAccount>,

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
    let stmt_bytes = args.statement.as_bytes();
    require!(
        stmt_bytes.len() <= MAX_STATEMENT_LEN,
        OpalError::StatementTooLong
    );
    let hash_bytes = args.auxiliary_hash.as_bytes();
    require!(
        hash_bytes.len() <= MAX_AUXILIARY_HASH_LEN,
        OpalError::AuxiliaryHashTooLong
    );

    let protocol_config = ctx.accounts.protocol_config.load()?;
    require!(
        args.assertion_bond_amount_pusd >= protocol_config.assertion_bond_min_pusd,
        OpalError::InsufficientBondAmount
    );
    require!(
        ctx.accounts.pusd_mint.key() == protocol_config.pusd_mint,
        OpalError::InvalidMint
    );

    let now = Clock::get()?.unix_timestamp;
    let liveness_deadline = checked_add_i64(now, protocol_config.liveness_window_seconds)?;

    let mut statement = [0u8; MAX_STATEMENT_LEN];
    statement[..stmt_bytes.len()].copy_from_slice(stmt_bytes);
    let mut auxiliary_hash = [0u8; MAX_AUXILIARY_HASH_LEN];
    auxiliary_hash[..hash_bytes.len()].copy_from_slice(hash_bytes);

    let mut assertion = ctx.accounts.assertion.load_init()?;
    assertion.id = args.assertion_id;
    assertion.asserter = ctx.accounts.asserter.key();
    assertion.statement = statement;
    assertion.auxiliary_hash = auxiliary_hash;
    assertion.bond_vault = ctx.accounts.bond_vault.key();
    assertion.state = ASSERTION_STATE_ASSERTED;
    assertion.liveness_deadline = liveness_deadline;
    assertion.llm_challenge_deadline = TIMESTAMP_NONE;
    // !TBD: Zero-copy memory is all-zeros by default. If outcome were ever read before
    // this explicit init, it would read as 0 (= OUTCOME_TRUE), not OUTCOME_NONE.
    assertion.outcome = OUTCOME_NONE;
    assertion.finalized_at = TIMESTAMP_NONE;
    assertion.dispute_count = 0;
    assertion.assertion_bond_amount_pusd = args.assertion_bond_amount_pusd;
    assertion.llm_dispute = Pubkey::default();
    assertion.vote_dispute = Pubkey::default();
    assertion.llm_resolution_round = Pubkey::default();
    assertion.vote_resolution_round = Pubkey::default();
    assertion.bump = ctx.bumps.assertion;

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
