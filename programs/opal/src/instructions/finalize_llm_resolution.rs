use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_ASSERTED_LLM, ASSERTION_STATE_RESOLVED, BOND_VAULT_SEED,
        LLM_DISPUTE_SEED, LLM_ROUND_SEED, PROTOCOL_CONFIG_SEED,
    },
    errors::OpalError,
    settlement::{settle, PayoutAccounts, Positions, Settlement},
    state::{AssertionAccount, LlmDisputeAccount, LlmResolutionRound, ProtocolConfig},
    utils::{is_outcome_set, is_pubkey_default, is_timestamp_set},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FinalizeLlmResolutionArgs {
    pub assertion_id: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: FinalizeLlmResolutionArgs)]
pub struct FinalizeLlmResolution<'info> {
    pub finalizer: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [ASSERTION_SEED, args.assertion_id.as_ref()],
        bump = assertion.load()?.bump,
    )]
    pub assertion: AccountLoader<'info, AssertionAccount>,

    #[account(
        mut,
        seeds = [LLM_DISPUTE_SEED, assertion.key().as_ref()],
        bump = llm_dispute.load()?.bump,
    )]
    pub llm_dispute: AccountLoader<'info, LlmDisputeAccount>,

    #[account(
        mut,
        seeds = [LLM_ROUND_SEED, assertion.key().as_ref()],
        bump = llm_resolution_round.load()?.bump,
    )]
    pub llm_resolution_round: AccountLoader<'info, LlmResolutionRound>,

    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, args.assertion_id.as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = assertion,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub asserter_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub llm_disputer_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub treasury_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<FinalizeLlmResolution>,
    _args: FinalizeLlmResolutionArgs,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let assertion = ctx.accounts.assertion.load()?;
    let llm_dispute = ctx.accounts.llm_dispute.load()?;
    let llm_round = ctx.accounts.llm_resolution_round.load()?;
    let protocol_config = ctx.accounts.protocol_config.load()?;

    require!(
        assertion.state == ASSERTION_STATE_ASSERTED_LLM,
        OpalError::InvalidState
    );
    require!(
        is_pubkey_default(&assertion.vote_dispute),
        OpalError::VoteDisputeAlreadyExists
    );
    require!(
        !is_outcome_set(llm_dispute.settlement_resolution),
        OpalError::AlreadySettled
    );

    require!(
        is_timestamp_set(llm_round.challenge_deadline),
        OpalError::MissingChallengeDeadline
    );
    require!(
        now >= llm_round.challenge_deadline,
        OpalError::DeadlineNotReached
    );

    require!(
        is_outcome_set(llm_round.outcome),
        OpalError::LlmOutcomeMissing
    );
    let final_outcome = llm_round.outcome;

    let positions = Positions {
        asserter: assertion.asserter,
        asserter_bond: assertion.assertion_bond_amount_usdc,
        llm_disputer: Some((llm_dispute.disputer, llm_dispute.bond_amount_usdc)),
    };
    let fee_bps = protocol_config.protocol_fee_bps;
    let treasury = protocol_config.treasury;
    let assertion_id = assertion.id;
    let bump = assertion.bump;
    drop(assertion);
    drop(llm_dispute);
    drop(llm_round);
    drop(protocol_config);

    let signer_seeds: &[&[u8]] = &[ASSERTION_SEED, assertion_id.as_ref(), &[bump]];
    settle(
        Settlement::LlmVerdict {
            outcome: final_outcome,
        },
        &positions,
        fee_bps,
        treasury,
        PayoutAccounts {
            bond_vault: &ctx.accounts.bond_vault,
            assertion: ctx.accounts.assertion.as_ref(),
            asserter_usdc: &ctx.accounts.asserter_usdc,
            llm_disputer_usdc: Some(&ctx.accounts.llm_disputer_usdc),
            treasury_usdc: &ctx.accounts.treasury_usdc,
        },
        signer_seeds,
    )?;

    let mut llm_dispute = ctx.accounts.llm_dispute.load_mut()?;
    llm_dispute.settlement_resolution = final_outcome;

    let mut assertion = ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_RESOLVED;
    assertion.outcome = final_outcome;
    assertion.finalized_at = now;

    Ok(())
}
