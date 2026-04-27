use crate::{constants::BPS_DENOMINATOR, errors::OpalError, state::ResolutionOutcome};
use anchor_lang::prelude::*;

pub fn map_outcome_code(outcome_code: u8) -> Result<ResolutionOutcome> {
    match outcome_code {
        0 => Ok(ResolutionOutcome::True),
        1 => Ok(ResolutionOutcome::False),
        2 => Ok(ResolutionOutcome::TooEarly),
        3 => Ok(ResolutionOutcome::Unresolvable),
        _ => err!(OpalError::InvalidOutcomeCode),
    }
}

pub fn checked_bps(amount: u64, bps: u16) -> Result<u64> {
    let result = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(OpalError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(OpalError::MathOverflow)?;

    u64::try_from(result).map_err(|_| error!(OpalError::MathOverflow))
}

pub fn checked_add_i64(lhs: i64, rhs: i64) -> Result<i64> {
    lhs.checked_add(rhs).ok_or_else(|| error!(OpalError::MathOverflow))
}
