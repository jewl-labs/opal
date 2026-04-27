use crate::{
    constants::{
        ASSERTION_SEED, BOND_VAULT_SEED, LLM_ROUND_SEED, PROTOCOL_CONFIG_SEED, VOTE_DISPUTE_SEED,
        VOTE_ROUND_SEED,
    },
    errors::OpalError,
    state::{
        AssertionAccount, AssertionState, LlmResolutionRound, ProtocolConfig, VoteDisputeAccount,
        VoteResolutionRound,
    },
    utils::checked_bps,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct ChallengeLlmResolution<'info> {
    #[account(mut)]
    pub disputer: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump,
        has_one = pusd_mint @ OpalError::InvalidPusdMint,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    pub pusd_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [ASSERTION_SEED, assertion.id.as_ref()],
        bump = assertion.bump,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        seeds = [LLM_ROUND_SEED, assertion.key().as_ref()],
        bump = llm_resolution_round.bump,
        constraint = llm_resolution_round.assertion == assertion.key() @ OpalError::AssertionLinkMismatch,
    )]
    pub llm_resolution_round: Account<'info, LlmResolutionRound>,

    #[account(
        init,
        payer = disputer,
        space = 8 + VoteDisputeAccount::INIT_SPACE,
        seeds = [VOTE_DISPUTE_SEED, assertion.key().as_ref()],
        bump
    )]
    pub vote_dispute: Account<'info, VoteDisputeAccount>,

    #[account(
        init,
        payer = disputer,
        space = 8 + VoteResolutionRound::INIT_SPACE,
        seeds = [VOTE_ROUND_SEED, assertion.key().as_ref()],
        bump
    )]
    pub vote_resolution_round: Account<'info, VoteResolutionRound>,

    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, assertion.id.as_ref()],
        bump,
        token::mint = pusd_mint,
        token::authority = assertion,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pusd_mint,
        token::authority = disputer,
    )]
    pub disputer_pusd: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ChallengeLlmResolution>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        ctx.accounts.assertion.state == AssertionState::AssertedLlm,
        OpalError::InvalidState
    );
    require!(
        ctx.accounts.assertion.dispute_count == 1 && ctx.accounts.assertion.vote_dispute.is_none(),
        OpalError::VoteDisputeAlreadyExists
    );

    let challenge_deadline = ctx
        .accounts
        .llm_resolution_round
        .challenge_deadline
        .ok_or(OpalError::MissingChallengeDeadline)?;
    require!(now < challenge_deadline, OpalError::DeadlinePassed);

    let challenged_llm_resolution = ctx
        .accounts
        .llm_resolution_round
        .outcome
        .ok_or(OpalError::LlmOutcomeMissing)?;

    let vote_bond_amount = checked_bps(
        ctx.accounts.assertion.assertion_bond_amount_pusd,
        ctx.accounts.protocol_config.vote_dispute_bond_ratio_bps,
    )?;
    require!(vote_bond_amount > 0, OpalError::InsufficientBondAmount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.disputer_pusd.to_account_info(),
                to: ctx.accounts.bond_vault.to_account_info(),
                authority: ctx.accounts.disputer.to_account_info(),
            },
        ),
        vote_bond_amount,
    )?;

    let vote_round_key = ctx.accounts.vote_resolution_round.key();

    ctx.accounts.vote_dispute.set_inner(VoteDisputeAccount {
        assertion: ctx.accounts.assertion.key(),
        disputer: ctx.accounts.disputer.key(),
        challenged_llm_resolution_round: ctx.accounts.llm_resolution_round.key(),
        challenged_llm_resolution,
        bond_amount_pusd: vote_bond_amount,
        created_at: now,
        resolution_round: vote_round_key,
        settlement_resolution: None,
        bump: ctx.bumps.vote_dispute,
    });

    ctx.accounts.vote_resolution_round.set_inner(VoteResolutionRound {
        assertion: ctx.accounts.assertion.key(),
        dispute: ctx.accounts.vote_dispute.key(),
        magicblock_validator: Pubkey::default(),
        permission_account: None,
        delegated_vote_state: None,
        delegated: false,
        committed: false,
        voting_starts_at: None,
        voting_deadline: None,
        reveal_deadline: None,
        total_valid_weight: 0,
        aggregate_votes: Default::default(),
        final_outcome: None,
        bump: ctx.bumps.vote_resolution_round,
    });

    let assertion = &mut ctx.accounts.assertion;
    assertion.state = AssertionState::PendingVote;
    assertion.dispute_count = 2;
    assertion.vote_dispute = Some(ctx.accounts.vote_dispute.key());
    assertion.vote_resolution_round = Some(vote_round_key);

    Ok(())
}
