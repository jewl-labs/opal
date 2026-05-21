use crate::{
    constants::{COUNCIL_SIZE, PROTOCOL_CONFIG_SEED},
    errors::OpalError,
    state::ProtocolConfig,
};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SetCouncilFeedsArgs {
    pub feeds: [Pubkey; COUNCIL_SIZE],
}

#[derive(Accounts)]
pub struct SetCouncilFeeds<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.load()?.bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,
}

pub fn handler(ctx: Context<SetCouncilFeeds>, args: SetCouncilFeedsArgs) -> Result<()> {
    let mut config = ctx.accounts.protocol_config.load_mut()?;
    require!(
        ctx.accounts.authority.key() == config.authority,
        OpalError::Unauthorized
    );
    require!(
        args.feeds.iter().all(|f| *f != Pubkey::default()),
        OpalError::ConfigInvariantViolation
    );
    require!(
        args.feeds[0] != args.feeds[1]
            && args.feeds[0] != args.feeds[2]
            && args.feeds[1] != args.feeds[2],
        OpalError::ConfigInvariantViolation
    );
    config.council_feeds = args.feeds;
    Ok(())
}
