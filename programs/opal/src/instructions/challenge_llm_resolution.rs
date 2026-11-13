use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_ASSERTED_LLM, ASSERTION_STATE_PENDING_VOTE,
        BOND_VAULT_SEED, LLM_ROUND_SEED, PROTOCOL_CONFIG_SEED, VOTE_DISPUTE_SEED,
    },
    errors::OpalError,
    state::{AssertionAccount, LlmResolutionRound, ProtocolConfig, VoteDisputeAccount},
    utils::{checked_bps, is_outcome_set, is_pubkey_default, is_timestamp_set},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ChallengeLlmResolutionArgs {
    pub assertion_id: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: ChallengeLlmResolutionArgs)]
pub struct ChallengeLlmResolution<'info> {
    #[account(mut)]
    pub disputer: Signer<'info>,

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
        seeds = [LLM_ROUND_SEED, assertion.key().as_ref()],
        bump = llm_resolution_round.load()?.bump,
    )]
    pub llm_resolution_round: AccountLoader<'info, LlmResolutionRound>,

    #[account(
        init,
        payer = disputer,
        space = 8 + std::mem::size_of::<VoteDisputeAccount>(),
        seeds = [VOTE_DISPUTE_SEED, assertion.key().as_ref()],
        bump
    )]
    pub vote_dispute: AccountLoader<'info, VoteDisputeAccount>,

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
        token::authority = disputer,
    )]
    pub disputer_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ChallengeLlmResolution>,
    _args: ChallengeLlmResolutionArgs,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let assertion = ctx.accounts.assertion.load()?;
    let llm_round = ctx.accounts.llm_resolution_round.load()?;
    let protocol_config = ctx.accounts.protocol_config.load()?;

    require!(
        assertion.state == ASSERTION_STATE_ASSERTED_LLM,
        OpalError::InvalidState
    );
    require!(
        assertion.dispute_count == 1 && is_pubkey_default(&assertion.vote_dispute),
        OpalError::VoteDisputeAlreadyExists
    );

    require!(
        is_timestamp_set(llm_round.challenge_deadline),
        OpalError::MissingChallengeDeadline
    );
    require!(
        now < llm_round.challenge_deadline,
        OpalError::DeadlinePassed
    );

    require!(
        is_outcome_set(llm_round.outcome),
        OpalError::LlmOutcomeMissing
    );
    let challenged_llm_resolution = llm_round.outcome;

    let vote_bond_amount = checked_bps(
        assertion.assertion_bond_amount_usdc,
        protocol_config.vote_dispute_bond_ratio_bps,
    )?;
    drop(assertion);
    drop(llm_round);
    drop(protocol_config);
    require!(vote_bond_amount > 0, OpalError::InsufficientBondAmount);

    token::transfer(
        CpiContext::new(
            Token::id(),
            Transfer {
                from: ctx.accounts.disputer_usdc.to_account_info(),
                to: ctx.accounts.bond_vault.to_account_info(),
                authority: ctx.accounts.disputer.to_account_info(),
            },
        ),
        vote_bond_amount,
    )?;

    let mut vote_dispute = ctx.accounts.vote_dispute.load_init()?;
    vote_dispute.assertion = ctx.accounts.assertion.key();
    vote_dispute.disputer = ctx.accounts.disputer.key();
    vote_dispute.challenged_llm_resolution_round = ctx.accounts.llm_resolution_round.key();
    vote_dispute.challenged_llm_resolution = challenged_llm_resolution;
    vote_dispute.bond_amount_usdc = vote_bond_amount;
    vote_dispute.created_at = now;
    vote_dispute.bump = ctx.bumps.vote_dispute;

    let mut assertion = ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_PENDING_VOTE;
    assertion.dispute_count = 2;
    assertion.vote_dispute = ctx.accounts.vote_dispute.key();

    Ok(())
}
