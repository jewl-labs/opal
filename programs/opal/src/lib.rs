use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("72kZgK51BsRWaLVcMriBuskWbn4d5E4P9HVeV3oBFp2y");

#[program]
pub mod opal {
    use super::*;

    // ── Config 

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        args: InitializeConfigArgs,
    ) -> Result<()> {
        ctx.accounts.initialize_config(args, ctx.bumps.config)
    }

    pub fn update_config(
        ctx: Context<InitializeConfig>,
        args: InitializeConfigArgs,
    ) -> Result<()> {
        ctx.accounts.update_config(args)
    }

    // ── Assertion lifecycle  

    /// Post a natural-language claim with a PUSD bond. Starts the liveness window.
    pub fn create_assertion(
        ctx: Context<CreateAssertion>,
        args: CreateAssertionArgs,
    ) -> Result<()> {
        ctx.accounts.create_assertion(args, &ctx.bumps)
    }

    /// Dispute an Asserted claim before liveness expires. Triggers LLM resolution.
    pub fn dispute_assertion(
        ctx: Context<DisputeAssertion>,
        args: DisputeAssertionArgs,
    ) -> Result<()> {
        ctx.accounts.dispute_assertion(args, &ctx.bumps)
    }

    /// Oracle authority posts the Switchboard-attested LLM outcome code.
    pub fn submit_llm_resolution(
        ctx: Context<SubmitLLMResolution>,
        args: SubmitLLMResolutionArgs,
    ) -> Result<()> {
        ctx.accounts.submit_llm_resolution(args)
    }

    /// After LLM challenge window expires with no second dispute: resolve and settle.
    pub fn finalize_llm_resolution(ctx: Context<FinalizeLLMResolution>) -> Result<()> {
        let bump = ctx.bumps.bond_vault;
        ctx.accounts.finalize_llm_resolution(bump)
    }

    /// Challenge the LLM verdict within its challenge window. Opens token voting.
    pub fn challenge_llm_resolution(ctx: Context<ChallengeLLMResolution>) -> Result<()> {
        ctx.accounts.challenge_llm_resolution(&ctx.bumps)
    }

    /// Initialize OPAL vault and set voting deadlines. Advances PendingVote → Voting.
    pub fn open_vote(ctx: Context<OpenVote>) -> Result<()> {
        ctx.accounts.open_vote()
    }

    /// Lock OPAL and submit a private vote commitment during the voting window.
    pub fn cast_vote(ctx: Context<CastVote>, args: CastVoteArgs) -> Result<()> {
        ctx.accounts.cast_vote(args, &ctx.bumps)
    }

    /// Reveal vote preimage after voting closes; tallies TWAV-weighted influence.
    pub fn reveal_vote(ctx: Context<RevealVote>, args: RevealVoteArgs) -> Result<()> {
        ctx.accounts.reveal_vote(args)
    }

    /// Apply supermajority threshold, resolve assertion, settle both dispute bonds.
    pub fn finalize_vote_resolution(ctx: Context<FinalizeVoteResolution>) -> Result<()> {
        let bump = ctx.bumps.bond_vault;
        ctx.accounts.finalize_vote_resolution(bump)
    }

    /// Voter claims back OPAL (+/- slash) and pro-rata PUSD reward if correct.
    pub fn settle_voter(ctx: Context<SettleVoter>) -> Result<()> {
        let opal_bump = ctx.bumps.opal_vault;
        let bond_bump = ctx.bumps.bond_vault;
        ctx.accounts.settle_voter(opal_bump, bond_bump)
    }

    /// After liveness window expires with no dispute: resolve True and return bond.
    pub fn finalize_undisputed(ctx: Context<FinalizeUndisputed>) -> Result<()> {
        let bump = ctx.bumps.bond_vault;
        ctx.accounts.finalize_undisputed(bump)
    }
}
