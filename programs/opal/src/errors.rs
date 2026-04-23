use anchor_lang::prelude::*;

#[error_code]
pub enum TemplateError {
    #[msg("An integer underflowed")]
    IntegerUnderflow,
    #[msg("An integer overflowed")]
    IntegerOverflow,
}
