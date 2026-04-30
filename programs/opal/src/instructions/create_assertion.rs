use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::errors::OpalError;
use crate::state::{AssertionAccount, AssertionState, ProtocolConfig, AUXILIARY_HASH_LEN, MAX_STATEMENT_LEN};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateAssertionArgs {
    pub id: Pubkey,
    pub statement: String,
    pub auxiliary_hash: String,
    pub bond_amount: u64,
}

#[derive(Accounts)]
#[instruction(args: CreateAssertionArgs)]
pub struct CreateAssertion<'info> {
    #[account(mut)]
    pub asserter: Signer<'info>,

    #[account(
        init,
        payer = asserter,
        space = 8 + AssertionAccount::INIT_SPACE,
        seeds = [b"assertion", args.id.as_ref()],
        bump,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        init,
        payer = asserter,
        token::mint = pusd_mint,
        token::authority = bond_vault,
        seeds = [b"bond_vault", assertion.key().as_ref()],
        bump,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pusd_mint,
        token::authority = asserter,
    )]
    pub asserter_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.pusd_mint == pusd_mint.key(),
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub pusd_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreateAssertion<'info> {
    pub fn create_assertion(&mut self, args: CreateAssertionArgs, bumps: &CreateAssertionBumps) -> Result<()> {
        require!(!args.statement.is_empty(), OpalError::EmptyStatement);
        require!(args.statement.len() <= MAX_STATEMENT_LEN, OpalError::StatementTooLong);
        require!(args.auxiliary_hash.len() == AUXILIARY_HASH_LEN, OpalError::InvalidAuxiliaryHash);
        require!(args.bond_amount >= self.config.assertion_bond_min_pusd, OpalError::BondTooLow);

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.asserter_token_account.to_account_info(),
                    to: self.bond_vault.to_account_info(),
                    authority: self.asserter.to_account_info(),
                },
            ),
            args.bond_amount,
        )?;

        let clock = Clock::get()?;
        let assertion = &mut self.assertion;

        assertion.id = args.id;
        assertion.asserter = self.asserter.key();
        assertion.statement = args.statement;
        assertion.auxiliary_hash = args.auxiliary_hash;
        assertion.assertion_bond = args.bond_amount;
        assertion.bond_vault = self.bond_vault.key();
        assertion.state = AssertionState::Asserted;
        assertion.liveness_deadline = clock
            .unix_timestamp
            .checked_add(self.config.liveness_window_seconds)
            .ok_or(OpalError::Overflow)?;
        assertion.outcome = None;
        assertion.finalized_at = None;
        assertion.dispute_count = 0;
        assertion.llm_dispute = None;
        assertion.vote_dispute = None;
        assertion.llm_resolution_round = None;
        assertion.vote_resolution_round = None;
        assertion.bump = bumps.assertion;

        Ok(())
    }
}
