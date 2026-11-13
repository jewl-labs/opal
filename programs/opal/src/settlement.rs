//! Bond-vault settlement: the only code that moves funds out of an assertion's bond vault.
//!
//! Instructions decide *that* an assertion settles and with which verdict; this module
//! decides *who gets what* (`plan`) and performs the transfers (`settle`).

use crate::{
    constants::{OUTCOME_FALSE, OUTCOME_TRUE, OUTCOME_UNRESOLVABLE},
    errors::OpalError,
    utils::checked_bps,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

/// How an assertion is being settled.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Settlement {
    /// Liveness elapsed with no dispute.
    Undisputed,
    /// The LLM verdict stood after its challenge window.
    LlmVerdict { outcome: u8 },
}

/// The bonds posted for the assertion, and who posted them.
#[derive(Debug, Clone, Copy)]
pub struct Positions {
    pub asserter: Pubkey,
    pub asserter_bond: u64,
    /// `Some((disputer, bond))` once the assertion was disputed, `None` while undisputed.
    pub llm_disputer: Option<(Pubkey, u64)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Payouts {
    pub asserter: u64,
    pub llm_disputer: u64,
    pub treasury: u64,
}

pub struct PayoutAccounts<'a, 'info> {
    pub bond_vault: &'a Account<'info, TokenAccount>,
    /// The assertion PDA, which is the bond vault's token authority.
    pub assertion: &'a AccountInfo<'info>,
    pub asserter_usdc: &'a Account<'info, TokenAccount>,
    pub llm_disputer_usdc: Option<&'a Account<'info, TokenAccount>>,
    pub treasury_usdc: &'a Account<'info, TokenAccount>,
}

/// Validates recipient owners (`InvalidAsserterTokenAccount` / `InvalidDisputerTokenAccount`)
/// and the treasury key (`InvalidTreasuryAccount`), plans the payouts, checks the vault covers
/// the bonds (`InsufficientVaultBalance`), then transfers every non-zero leg signed by the
/// assertion PDA. Nothing moves if any check fails.
pub fn settle(
    s: Settlement,
    positions: &Positions,
    fee_bps: u16,
    treasury: Pubkey,
    accounts: PayoutAccounts,
    signer_seeds: &[&[u8]],
) -> Result<Payouts> {
    // A disputer position exists exactly when the settlement involves one; otherwise a bond
    // would be left in the vault.
    require!(
        matches!(s, Settlement::Undisputed) == positions.llm_disputer.is_none(),
        OpalError::InvalidState
    );

    require!(
        accounts.asserter_usdc.owner == positions.asserter,
        OpalError::InvalidAsserterTokenAccount
    );
    if let Some((disputer, _)) = positions.llm_disputer {
        require!(
            accounts
                .llm_disputer_usdc
                .is_some_and(|account| account.owner == disputer),
            OpalError::InvalidDisputerTokenAccount
        );
    }
    require!(
        accounts.treasury_usdc.key() == treasury,
        OpalError::InvalidTreasuryAccount
    );

    let llm_disputer_bond = positions.llm_disputer.map_or(0, |(_, bond)| bond);
    let payouts = plan(s, positions.asserter_bond, llm_disputer_bond, fee_bps)?;

    let bonds = positions
        .asserter_bond
        .checked_add(llm_disputer_bond)
        .ok_or(OpalError::MathOverflow)?;
    require!(
        accounts.bond_vault.amount >= bonds,
        OpalError::InsufficientVaultBalance
    );

    pay(
        &accounts,
        accounts.asserter_usdc,
        payouts.asserter,
        signer_seeds,
    )?;
    if let Some(llm_disputer_usdc) = accounts.llm_disputer_usdc {
        pay(
            &accounts,
            llm_disputer_usdc,
            payouts.llm_disputer,
            signer_seeds,
        )?;
    }
    pay(
        &accounts,
        accounts.treasury_usdc,
        payouts.treasury,
        signer_seeds,
    )?;

    Ok(payouts)
}

fn plan(
    s: Settlement,
    asserter_bond: u64,
    llm_disputer_bond: u64,
    fee_bps: u16,
) -> Result<Payouts> {
    match s {
        Settlement::Undisputed => {
            let fee = checked_bps(asserter_bond, fee_bps)?;
            Ok(Payouts {
                asserter: asserter_bond
                    .checked_sub(fee)
                    .ok_or(OpalError::MathOverflow)?,
                llm_disputer: 0,
                treasury: fee,
            })
        }
        Settlement::LlmVerdict { outcome } => match outcome {
            // The assertion stood: the asserter keeps their bond and wins the disputer's,
            // minus the protocol fee on the winnings.
            OUTCOME_TRUE => {
                let fee = checked_bps(llm_disputer_bond, fee_bps)?;
                let winnings = llm_disputer_bond
                    .checked_sub(fee)
                    .ok_or(OpalError::MathOverflow)?;
                Ok(Payouts {
                    asserter: asserter_bond
                        .checked_add(winnings)
                        .ok_or(OpalError::MathOverflow)?,
                    llm_disputer: 0,
                    treasury: fee,
                })
            }
            // The disputer was right. Unresolvable is fault-assigned to the asserter, so it
            // pays out exactly like False.
            OUTCOME_FALSE | OUTCOME_UNRESOLVABLE => {
                let fee = checked_bps(asserter_bond, fee_bps)?;
                let winnings = asserter_bond
                    .checked_sub(fee)
                    .ok_or(OpalError::MathOverflow)?;
                Ok(Payouts {
                    asserter: 0,
                    llm_disputer: llm_disputer_bond
                        .checked_add(winnings)
                        .ok_or(OpalError::MathOverflow)?,
                    treasury: fee,
                })
            }
            _ => err!(OpalError::InvalidOutcomeCode),
        },
    }
}

/// Transfers `amount` out of the bond vault, signed by the assertion PDA. A zero leg is a no-op.
fn pay<'info>(
    accounts: &PayoutAccounts<'_, 'info>,
    to: &Account<'info, TokenAccount>,
    amount: u64,
    signer_seeds: &[&[u8]],
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    token::transfer(
        CpiContext::new_with_signer(
            Token::id(),
            Transfer {
                from: accounts.bond_vault.to_account_info(),
                to: to.to_account_info(),
                authority: accounts.assertion.clone(),
            },
            &[signer_seeds],
        ),
        amount,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn code(e: Error) -> u32 {
        match e {
            Error::AnchorError(e) => e.error_code_number,
            other => panic!("unexpected error: {other:?}"),
        }
    }

    fn payouts(asserter: u64, llm_disputer: u64, treasury: u64) -> Payouts {
        Payouts {
            asserter,
            llm_disputer,
            treasury,
        }
    }

    #[test]
    fn pins_current_payout_numbers() {
        let llm = |outcome| Settlement::LlmVerdict { outcome };
        let cases = [
            // (settlement, asserter bond, llm disputer bond, fee bps, expected)
            (Settlement::Undisputed, 200, 0, 250, payouts(195, 0, 5)),
            (Settlement::Undisputed, 200, 0, 0, payouts(200, 0, 0)),
            (llm(OUTCOME_TRUE), 200, 100, 250, payouts(298, 0, 2)),
            (llm(OUTCOME_FALSE), 200, 100, 250, payouts(0, 295, 5)),
            (llm(OUTCOME_UNRESOLVABLE), 200, 100, 250, payouts(0, 295, 5)),
        ];

        for (settlement, asserter_bond, llm_disputer_bond, fee_bps, expected) in cases {
            let got = plan(settlement, asserter_bond, llm_disputer_bond, fee_bps).unwrap();
            assert_eq!(
                got, expected,
                "{settlement:?} bonds {asserter_bond}/{llm_disputer_bond} fee {fee_bps}"
            );
        }
    }

    #[test]
    fn payouts_conserve_the_bonds() {
        let bonds = [0, 1, 99, 1_000_000, 500_000_000, u64::MAX];
        let fees = [0, 1, 250, 10_000];
        let llm = |outcome| Settlement::LlmVerdict { outcome };

        for fee_bps in fees {
            for asserter_bond in bonds {
                let undisputed = plan(Settlement::Undisputed, asserter_bond, 0, fee_bps);
                assert_conserved(undisputed, asserter_bond, 0);

                for llm_disputer_bond in bonds {
                    for outcome in [OUTCOME_TRUE, OUTCOME_FALSE, OUTCOME_UNRESOLVABLE] {
                        let result = plan(llm(outcome), asserter_bond, llm_disputer_bond, fee_bps);
                        assert_conserved(result, asserter_bond, llm_disputer_bond);
                    }
                }
            }
        }
    }

    fn assert_conserved(result: Result<Payouts>, asserter_bond: u64, llm_disputer_bond: u64) {
        match result {
            Ok(p) => assert_eq!(
                u128::from(p.asserter) + u128::from(p.llm_disputer) + u128::from(p.treasury),
                u128::from(asserter_bond) + u128::from(llm_disputer_bond),
                "payouts {p:?} do not sum to bonds {asserter_bond}/{llm_disputer_bond}"
            ),
            Err(e) => assert_eq!(code(e), u32::from(OpalError::MathOverflow)),
        }
    }

    #[test]
    fn rejects_outcome_codes_the_resolver_cannot_post() {
        for outcome in [2, 4, 255] {
            let err = plan(Settlement::LlmVerdict { outcome }, 200, 100, 250).unwrap_err();
            assert_eq!(code(err), u32::from(OpalError::InvalidOutcomeCode));
        }
    }
}
