use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod settlement;
pub mod state;
pub mod utils;

pub use instructions::*;

declare_id!("8NCcxyAzKiAHxJ9DMnADtxShYutS9w81wHcXqgCavTBy");

#[program]
pub mod opal {

    use super::*;

    pub fn initialize_protocol_config(
        ctx: Context<InitializeProtocolConfig>,
        args: InitializeProtocolConfigArgs,
    ) -> Result<()> {
        instructions::initialize_protocol_config::handler(ctx, args)
    }

    pub fn create_assertion(
        ctx: Context<CreateAssertion>,
        args: CreateAssertionArgs,
    ) -> Result<()> {
        instructions::create_assertion::handler(ctx, args)
    }

    pub fn finalize_undisputed(
        ctx: Context<FinalizeUndisputed>,
        args: FinalizeUndisputedArgs,
    ) -> Result<()> {
        instructions::finalize_undisputed::handler(ctx, args)
    }

    pub fn dispute_assertion(
        ctx: Context<DisputeAssertion>,
        args: DisputeAssertionArgs,
    ) -> Result<()> {
        instructions::dispute_assertion::handler(ctx, args)
    }

    pub fn submit_llm_resolution(
        ctx: Context<SubmitLlmResolution>,
        args: SubmitLlmResolutionArgs,
    ) -> Result<()> {
        instructions::submit_llm_resolution::handler(ctx, args)
    }

    pub fn finalize_llm_resolution(
        ctx: Context<FinalizeLlmResolution>,
        args: FinalizeLlmResolutionArgs,
    ) -> Result<()> {
        instructions::finalize_llm_resolution::handler(ctx, args)
    }

    pub fn challenge_llm_resolution(
        ctx: Context<ChallengeLlmResolution>,
        args: ChallengeLlmResolutionArgs,
    ) -> Result<()> {
        instructions::challenge_llm_resolution::handler(ctx, args)
    }
}
