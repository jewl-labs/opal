use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::OpalError;
use crate::state::{AssertionAccount, AssertionState, ProtocolConfig};

#[derive(Accounts)]
#[instruction(assertion_id: u64)]
pub struct CreateAssertion<'info> {
    #[account(
        init,
        payer = asserter,
        space = 8 + AssertionAccount::INIT_SPACE,
        seeds = [b"assertion", asserter.key().as_ref(), &assertion_id.to_le_bytes()],
        bump,
    )]
    pub assertion: Box<Account<'info, AssertionAccount>>,

    #[account(
        init,
        payer = asserter,
        seeds = [b"bond_vault", assertion.key().as_ref()],
        bump,
        token::mint = pusd_mint,
        token::authority = assertion,
    )]
    pub bond_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = asserter_pusd.owner == asserter.key() @ OpalError::Unauthorized,
        constraint = asserter_pusd.mint == pusd_mint.key() @ OpalError::InvalidState,
    )]
    pub asserter_pusd: Box<Account<'info, TokenAccount>>,

    pub pusd_mint: Account<'info, Mint>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub asserter: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreateAssertion<'info> {
    pub fn create_assertion(
        &mut self,
        bumps: &CreateAssertionBumps,
        assertion_id: u64,
        statement: String,
        auxiliary_hash: [u8; 32],
        bond_amount: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let liveness_window = self.protocol_config.liveness_window_secs;
        let bond_min = self.protocol_config.assertion_bond_min;

        require!(bond_amount >= bond_min, OpalError::BondTooSmall);

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.asserter_pusd.to_account_info(),
                    to: self.bond_vault.to_account_info(),
                    authority: self.asserter.to_account_info(),
                },
            ),
            bond_amount,
        )?;

        let assertion = &mut self.assertion;
        assertion.assertion_id = assertion_id;
        assertion.asserter = self.asserter.key();
        assertion.statement = statement;
        assertion.auxiliary_hash = auxiliary_hash;
        assertion.bond_vault = self.bond_vault.key();
        assertion.bond_amount = bond_amount;
        assertion.state = AssertionState::Asserted;
        assertion.liveness_deadline = clock.unix_timestamp + liveness_window;
        assertion.outcome = None;
        assertion.finalized_at = None;
        assertion.dispute_count = 0;
        assertion.llm_dispute = None;
        assertion.llm_resolution_round = None;
        assertion.bump = bumps.assertion;

        Ok(())
    }
}
