use crate::{errors::TemplateError, state::Counter};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Decrement<'info> {
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"counter"],
        bump
    )]
    pub counter: Account<'info, Counter>,
}

impl<'info> Decrement<'info> {
    pub fn decrement(&mut self) -> Result<()> {
        self.counter.value = self.counter
            .value
            .checked_sub(1)
            .ok_or(TemplateError::IntegerUnderflow)?;
        Ok(())
    }
}
