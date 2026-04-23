use crate::state::Counter;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + Counter::INIT_SPACE,
        seeds = [b"counter"],
        bump,
    )]
    pub counter: Account<'info, Counter>,

    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self, bump: u8) -> Result<()> {
        self.counter.bump = bump;
        Ok(())
    }
}
