use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::OpalError;
use crate::state::{AssertionAccount, AssertionState, ProtocolConfig, ResolutionOutcome};

#[derive(Accounts)]
pub struct FinalizeUndisputed<'info> {
    #[account(
        mut,
        seeds = [b"assertion", assertion.asserter.as_ref(), &assertion.assertion_id.to_le_bytes()],
        bump = assertion.bump,
    )]
    pub assertion: Box<Account<'info, AssertionAccount>>,

    #[account(
        mut,
        seeds = [b"bond_vault", assertion.key().as_ref()],
        bump,
        token::mint = asserter_pusd.mint,
        token::authority = assertion,
    )]
    pub bond_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = asserter_pusd.owner == assertion.asserter @ OpalError::Unauthorized,
    )]
    pub asserter_pusd: Box<Account<'info, TokenAccount>>,

    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    pub token_program: Program<'info, Token>,

    /// Anyone can call finalize after liveness expires.
    pub caller: Signer<'info>,
}

impl<'info> FinalizeUndisputed<'info> {
    pub fn finalize_undisputed(&mut self) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            self.assertion.state == AssertionState::Asserted,
            OpalError::InvalidState
        );
        require!(
            clock.unix_timestamp > self.assertion.liveness_deadline,
            OpalError::LivenessWindowActive
        );

        let bond_amount = self.bond_vault.amount;
        let assertion_id_bytes = self.assertion.assertion_id.to_le_bytes();
        let asserter = self.assertion.asserter;
        let bump = self.assertion.bump;

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"assertion",
            asserter.as_ref(),
            assertion_id_bytes.as_ref(),
            &[bump],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.bond_vault.to_account_info(),
                    to: self.asserter_pusd.to_account_info(),
                    authority: self.assertion.to_account_info(),
                },
                signer_seeds,
            ),
            bond_amount,
        )?;

        let assertion = &mut self.assertion;
        assertion.state = AssertionState::Resolved;
        assertion.outcome = Some(ResolutionOutcome::True);
        assertion.finalized_at = Some(clock.unix_timestamp);

        Ok(())
    }
}
