use crate::{
    constants::PROTOCOL_CONFIG_SEED, errors::OpalError, state::ProtocolConfig,
    utils::is_pubkey_default,
};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct UpdateResolverArgs {
    pub new_resolver: Pubkey,
}

#[derive(Accounts)]
pub struct UpdateResolver<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.load()?.bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,
}

pub fn handler(ctx: Context<UpdateResolver>, args: UpdateResolverArgs) -> Result<()> {
    let mut config = ctx.accounts.protocol_config.load_mut()?;
    require!(
        ctx.accounts.authority.key() == config.authority,
        OpalError::Unauthorized
    );
    require!(
        !is_pubkey_default(&args.new_resolver)
            && args.new_resolver != config.authority
            && args.new_resolver != config.resolver,
        OpalError::ConfigInvariantViolation
    );

    let previous_resolver = config.resolver;
    config.resolver = args.new_resolver;
    msg!(
        "resolver rotated from {} to {}",
        previous_resolver,
        args.new_resolver
    );
    Ok(())
}
