use crate::{
    constants::{BPS_DENOMINATOR, OUTCOME_NONE, OUTCOME_UNRESOLVABLE, TIMESTAMP_NONE},
    errors::OpalError,
};
use anchor_lang::prelude::*;

pub fn validate_outcome_code(outcome_code: u8) -> Result<u8> {
    require!(
        outcome_code <= OUTCOME_UNRESOLVABLE,
        OpalError::InvalidOutcomeCode
    );
    Ok(outcome_code)
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
    lhs.checked_add(rhs)
        .ok_or_else(|| error!(OpalError::MathOverflow))
}

pub fn is_pubkey_default(pk: &Pubkey) -> bool {
    *pk == Pubkey::default()
}

pub fn is_timestamp_set(ts: i64) -> bool {
    ts != TIMESTAMP_NONE
}

pub fn is_outcome_set(outcome: u8) -> bool {
    outcome != OUTCOME_NONE
}
