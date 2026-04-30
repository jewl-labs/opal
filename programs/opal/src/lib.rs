use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("72kZgK51BsRWaLVcMriBuskWbn4d5E4P9HVeV3oBFp2y");

#[program]
pub mod opal {
    use super::*;

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
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
        ctx.accounts.initialize_protocol(
            &ctx.bumps,
            oracle_authority,
            assertion_bond_min,
            liveness_window_secs,
            llm_challenge_window_secs,
            switchboard_queue,
            max_staleness_slots,
            pusd_mint,
            treasury,
            protocol_fee_bps,
        )
    }

    pub fn create_assertion(
        ctx: Context<CreateAssertion>,
        assertion_id: u64,
        statement: String,
        auxiliary_hash: [u8; 32],
        bond_amount: u64,
    ) -> Result<()> {
        ctx.accounts
            .create_assertion(&ctx.bumps, assertion_id, statement, auxiliary_hash, bond_amount)
    }

    pub fn finalize_undisputed(ctx: Context<FinalizeUndisputed>) -> Result<()> {
        ctx.accounts.finalize_undisputed()
    }

    pub fn dispute_assertion(
        ctx: Context<DisputeAssertion>,
        bond_amount: u64,
        switchboard_feed_hash: [u8; 32],
    ) -> Result<()> {
        ctx.accounts
            .dispute_assertion(&ctx.bumps, bond_amount, switchboard_feed_hash)
    }

    pub fn submit_llm_resolution(
        ctx: Context<SubmitLlmResolution>,
        prompt_hash: [u8; 32],
    ) -> Result<()> {
        ctx.accounts.submit_llm_resolution(prompt_hash)
    }

    pub fn finalize_llm_resolution(ctx: Context<FinalizeLlmResolution>) -> Result<()> {
        ctx.accounts.finalize_llm_resolution()
    }
}
