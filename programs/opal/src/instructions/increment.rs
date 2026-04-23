use crate::{errors::TemplateError, state::Counter};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Increment<'info> {
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"counter"],
        bump
    )]
    pub counter: Account<'info, Counter>,
}

impl<'info> Increment<'info> {
    pub fn increment(&mut self) -> Result<()> {
        self.counter.value = self.counter
            .value
            .checked_add(1)
            .ok_or(TemplateError::IntegerOverflow)?;
        Ok(())
    }
}
