use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

pub use instructions::*;

// protocol
pub use instructions::initialize_protocol_config::{
    InitializeProtocolConfig, InitializeProtocolConfigArgs,
};

// assertion lifecycle
pub use instructions::create_assertion::{CreateAssertion, CreateAssertionArgs};
pub use instructions::dispute_assertion::DisputeAssertion;
pub use instructions::finalize_undisputed::FinalizeUndisputed;

// llm resolution
pub use instructions::challenge_llm_resolution::ChallengeLlmResolution;
pub use instructions::configure_llm_round::{ConfigureLlmRound, ConfigureLlmRoundArgs};
pub use instructions::finalize_llm_resolution::FinalizeLlmResolution;
pub use instructions::submit_llm_resolution::{SubmitLlmResolution, SubmitLlmResolutionArgs};
// Authority-gated; for local testing only. #[program] does not support #[cfg] on individual fns.
pub use instructions::submit_mock_llm_resolution::{
    SubmitMockLlmResolution, SubmitMockLlmResolutionArgs,
};

// vote resolution
pub use instructions::cast_vote::{CastVote, CastVoteArgs};
pub use instructions::claim_vote_reward::ClaimVoteReward;
pub use instructions::finalize_vote_resolution::FinalizeVoteResolution;
pub use instructions::finalize_vote_resolution_placeholder::{
    FinalizeVoteResolutionPlaceholder, FinalizeVoteResolutionPlaceholderArgs,
};
pub use instructions::open_vote::OpenVote;
pub use instructions::reveal_vote::{RevealVote, RevealVoteArgs};

declare_id!("72kZgK51BsRWaLVcMriBuskWbn4d5E4P9HVeV3oBFp2y");

#[program]
pub mod opal {

    use super::*;

    // Protocol

    pub fn initialize_protocol_config(
        ctx: Context<InitializeProtocolConfig>,
        args: InitializeProtocolConfigArgs,
    ) -> Result<()> {
        instructions::initialize_protocol_config::handler(ctx, args)
    }

    // Assertion lifecycle

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

    // LLM resolution

    pub fn configure_llm_round(
        ctx: Context<ConfigureLlmRound>,
        args: ConfigureLlmRoundArgs,
    ) -> Result<()> {
        instructions::configure_llm_round::handler(ctx, args)
    }

    pub fn submit_llm_resolution(
        ctx: Context<SubmitLlmResolution>,
        args: SubmitLlmResolutionArgs,
    ) -> Result<()> {
        instructions::submit_llm_resolution::handler(ctx, args)
    }

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

    // Vote resolution

    pub fn open_vote(ctx: Context<OpenVote>) -> Result<()> {
        instructions::open_vote::handler(ctx)
    }

    pub fn cast_vote(ctx: Context<CastVote>, args: CastVoteArgs) -> Result<()> {
        instructions::cast_vote::handler(ctx, args)
    }

    pub fn reveal_vote(ctx: Context<RevealVote>, args: RevealVoteArgs) -> Result<()> {
        instructions::reveal_vote::handler(ctx, args)
    }

    pub fn finalize_vote_resolution(ctx: Context<FinalizeVoteResolution>) -> Result<()> {
        instructions::finalize_vote_resolution::handler(ctx)
    }

    pub fn claim_vote_reward(ctx: Context<ClaimVoteReward>) -> Result<()> {
        instructions::claim_vote_reward::handler(ctx)
    }

    pub fn finalize_vote_resolution_placeholder(
        ctx: Context<FinalizeVoteResolutionPlaceholder>,
        args: FinalizeVoteResolutionPlaceholderArgs,
    ) -> Result<()> {
        instructions::finalize_vote_resolution_placeholder::handler(ctx, args)
    }
}
