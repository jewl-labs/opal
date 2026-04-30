use anchor_lang::prelude::*;

use crate::state::ProtocolConfig;

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [b"protocol_config"],
        bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeProtocol<'info> {
    pub fn initialize_protocol(
        &mut self,
        bumps: &InitializeProtocolBumps,
        oracle_authority: Pubkey,
        assertion_bond_min: u64,
        liveness_window_secs: i64,
        llm_challenge_window_secs: i64,
        switchboard_queue: Pubkey,
        max_staleness_slots: u64,
        pusd_mint: Pubkey,
        treasury: Pubkey,
        protocol_fee_bps: u16,
    ) -> Result<()> {
        let config = &mut self.protocol_config;
        config.authority = self.authority.key();
        config.oracle_authority = oracle_authority;
        config.assertion_bond_min = assertion_bond_min;
        config.liveness_window_secs = liveness_window_secs;
        config.llm_challenge_window_secs = llm_challenge_window_secs;
        config.switchboard_queue = switchboard_queue;
        config.max_staleness_slots = max_staleness_slots;
        config.pusd_mint = pusd_mint;
        config.treasury = treasury;
        config.protocol_fee_bps = protocol_fee_bps;
        config.bump = bumps.protocol_config;
        Ok(())
    }
}
