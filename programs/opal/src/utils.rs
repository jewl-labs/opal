use crate::{
    constants::{
        ARWEAVE_TRANSACTION_ID_LEN, BPS_DENOMINATOR, OUTCOME_FALSE, OUTCOME_NONE, OUTCOME_TRUE,
        OUTCOME_UNRESOLVABLE, RESOLUTION_SPEC_REFERENCE_DIGEST_SEPARATOR,
        RESOLUTION_SPEC_REFERENCE_LEN, RESOLUTION_SPEC_REFERENCE_PREFIX, SHA256_HEX_LEN,
        TIMESTAMP_NONE,
    },
    errors::OpalError,
};
use anchor_lang::prelude::*;

pub fn validate_outcome_code(outcome_code: u8) -> Result<u8> {
    require!(
        matches!(
            outcome_code,
            OUTCOME_TRUE | OUTCOME_FALSE | OUTCOME_UNRESOLVABLE
        ),
        OpalError::InvalidOutcomeCode
    );
    Ok(outcome_code)
}

pub fn validate_resolution_spec_reference(reference: &str) -> Result<()> {
    let bytes = reference.as_bytes();
    let transaction_id_start = RESOLUTION_SPEC_REFERENCE_PREFIX.len();
    let transaction_id_end = transaction_id_start + ARWEAVE_TRANSACTION_ID_LEN;
    let digest_separator_end =
        transaction_id_end + RESOLUTION_SPEC_REFERENCE_DIGEST_SEPARATOR.len();
    let digest_end = digest_separator_end + SHA256_HEX_LEN;

    let valid = bytes.len() == RESOLUTION_SPEC_REFERENCE_LEN
        && bytes.starts_with(RESOLUTION_SPEC_REFERENCE_PREFIX)
        && bytes[transaction_id_start..transaction_id_end]
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
        && bytes[transaction_id_end..digest_separator_end]
            == *RESOLUTION_SPEC_REFERENCE_DIGEST_SEPARATOR
        && bytes[digest_separator_end..digest_end]
            .iter()
            .all(u8::is_ascii_hexdigit);
    require!(valid, OpalError::InvalidResolutionSpecReference);
    Ok(())
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
