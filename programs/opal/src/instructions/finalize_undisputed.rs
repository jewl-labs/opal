use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::OpalError;
use crate::state::{AssertionAccount, AssertionState, ProtocolConfig, ResolutionOutcome};

#[derive(Accounts)]
pub struct FinalizeUndisputed<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"assertion", assertion.id.as_ref()],
        bump = assertion.bump,
        constraint = assertion.state == AssertionState::Asserted @ OpalError::InvalidState,
        constraint = assertion.dispute_count == 0 @ OpalError::AlreadyDisputed,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [b"bond_vault", assertion.key().as_ref()],
        bump,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = bond_vault.mint,
        constraint = asserter_token_account.owner == assertion.asserter @ OpalError::Unauthorized,
    )]
    pub asserter_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = bond_vault.mint,
        constraint = treasury_token_account.key() == config.treasury @ OpalError::Unauthorized,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,

    pub token_program: Program<'info, Token>,
}

impl<'info> FinalizeUndisputed<'info> {
    pub fn finalize_undisputed(&mut self, bond_vault_bump: u8) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            clock.unix_timestamp > self.assertion.liveness_deadline,
            OpalError::LivenessNotExpired
        );

        let assertion_bond = self.assertion.assertion_bond;

        let fee = (assertion_bond as u128)
            .checked_mul(self.config.protocol_fee_bps as u128)
            .ok_or(OpalError::Overflow)?
            .checked_div(10_000)
            .ok_or(OpalError::DivisionByZero)? as u64;
        let asserter_return = assertion_bond.checked_sub(fee).ok_or(OpalError::Overflow)?;

        let assertion_key = self.assertion.key();
        let vault_seeds: &[&[u8]] = &[b"bond_vault", assertion_key.as_ref(), &[bond_vault_bump]];
        let signer = &[vault_seeds];

        if asserter_return > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    Transfer {
                        from: self.bond_vault.to_account_info(),
                        to: self.asserter_token_account.to_account_info(),
                        authority: self.bond_vault.to_account_info(),
                    },
                    signer,
                ),
                asserter_return,
            )?;
        }

        if fee > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    Transfer {
                        from: self.bond_vault.to_account_info(),
                        to: self.treasury_token_account.to_account_info(),
                        authority: self.bond_vault.to_account_info(),
                    },
                    signer,
                ),
                fee,
            )?;
        }

        self.assertion.state = AssertionState::Resolved;
        self.assertion.outcome = Some(ResolutionOutcome::True);
        self.assertion.finalized_at = Some(clock.unix_timestamp);

        Ok(())
    }
}
