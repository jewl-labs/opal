use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

pub use instructions::*;

pub use instructions::challenge_llm_resolution::ChallengeLlmResolution;
pub use instructions::create_assertion::{CreateAssertion, CreateAssertionArgs};
pub use instructions::dispute_assertion::DisputeAssertion;
pub use instructions::finalize_llm_resolution::FinalizeLlmResolution;
pub use instructions::finalize_undisputed::FinalizeUndisputed;
pub use instructions::finalize_vote_resolution_placeholder::{
    FinalizeVoteResolutionPlaceholder, FinalizeVoteResolutionPlaceholderArgs,
};
pub use instructions::initialize_protocol_config::{
    InitializeProtocolConfig, InitializeProtocolConfigArgs,
};
pub use instructions::open_vote::OpenVote;
pub use instructions::set_council_feeds::{SetCouncilFeeds, SetCouncilFeedsArgs};
pub use instructions::submit_llm_resolution::SubmitLlmResolution;

#[cfg(feature = "mock-llm")]
pub use instructions::submit_mock_llm_resolution::{
    SubmitMockLlmResolution, SubmitMockLlmResolutionArgs,
};

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

    pub fn finalize_undisputed(ctx: Context<FinalizeUndisputed>) -> Result<()> {
        instructions::finalize_undisputed::handler(ctx)
    }

    pub fn dispute_assertion(ctx: Context<DisputeAssertion>) -> Result<()> {
        instructions::dispute_assertion::handler(ctx)
    }

    pub fn set_council_feeds(
        ctx: Context<SetCouncilFeeds>,
        args: SetCouncilFeedsArgs,
    ) -> Result<()> {
        instructions::set_council_feeds::handler(ctx, args)
    }

    pub fn submit_llm_resolution(ctx: Context<SubmitLlmResolution>) -> Result<()> {
        instructions::submit_llm_resolution::handler(ctx)
    }

    #[cfg(feature = "mock-llm")]
    pub fn submit_mock_llm_resolution(
        ctx: Context<SubmitMockLlmResolution>,
        args: SubmitMockLlmResolutionArgs,
    ) -> Result<()> {
        instructions::submit_mock_llm_resolution::handler(ctx, args)
    }

    pub fn finalize_llm_resolution(ctx: Context<FinalizeLlmResolution>) -> Result<()> {
        instructions::finalize_llm_resolution::handler(ctx)
    }

    pub fn challenge_llm_resolution(ctx: Context<ChallengeLlmResolution>) -> Result<()> {
        instructions::challenge_llm_resolution::handler(ctx)
    }

    pub fn open_vote(ctx: Context<OpenVote>) -> Result<()> {
        instructions::open_vote::handler(ctx)
    }

    pub fn finalize_vote_resolution_placeholder(
        ctx: Context<FinalizeVoteResolutionPlaceholder>,
        args: FinalizeVoteResolutionPlaceholderArgs,
    ) -> Result<()> {
        instructions::finalize_vote_resolution_placeholder::handler(ctx, args)
    }
}
