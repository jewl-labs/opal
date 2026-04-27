use crate::{
    constants::{
        ASSERTION_SEED, BOND_VAULT_SEED, LLM_DISPUTE_SEED, LLM_ROUND_SEED, PROTOCOL_CONFIG_SEED,
    },
    errors::OpalError,
    state::{
        AssertionAccount, AssertionState, LlmDisputeAccount, LlmResolutionRound, ProtocolConfig,
    },
    utils::checked_bps,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct DisputeAssertion<'info> {
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
        init,
        payer = disputer,
        space = 8 + LlmDisputeAccount::INIT_SPACE,
        seeds = [LLM_DISPUTE_SEED, assertion.key().as_ref()],
        bump
    )]
    pub llm_dispute: Account<'info, LlmDisputeAccount>,

    #[account(
        init,
        payer = disputer,
        space = 8 + LlmResolutionRound::INIT_SPACE,
        seeds = [LLM_ROUND_SEED, assertion.key().as_ref()],
        bump
    )]
    pub llm_resolution_round: Account<'info, LlmResolutionRound>,

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

pub fn handler(ctx: Context<DisputeAssertion>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        ctx.accounts.assertion.state == AssertionState::Asserted,
        OpalError::InvalidState
    );
    require!(
        now < ctx.accounts.assertion.liveness_deadline,
        OpalError::DeadlinePassed
    );
    require!(
        ctx.accounts.assertion.dispute_count == 0 && ctx.accounts.assertion.llm_dispute.is_none(),
        OpalError::AssertionAlreadyDisputed
    );

    let bond_amount = checked_bps(
        ctx.accounts.assertion.assertion_bond_amount_pusd,
        ctx.accounts.protocol_config.llm_dispute_bond_ratio_bps,
    )?;
    require!(bond_amount > 0, OpalError::InsufficientBondAmount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.disputer_pusd.to_account_info(),
                to: ctx.accounts.bond_vault.to_account_info(),
                authority: ctx.accounts.disputer.to_account_info(),
            },
        ),
        bond_amount,
    )?;

    let llm_round_key = ctx.accounts.llm_resolution_round.key();

    ctx.accounts.llm_dispute.set_inner(LlmDisputeAccount {
        assertion: ctx.accounts.assertion.key(),
        disputer: ctx.accounts.disputer.key(),
        bond_amount_pusd: bond_amount,
        created_at: now,
        resolution_round: llm_round_key,
        settlement_resolution: None,
        bump: ctx.bumps.llm_dispute,
    });

    ctx.accounts.llm_resolution_round.set_inner(LlmResolutionRound {
        assertion: ctx.accounts.assertion.key(),
        dispute: ctx.accounts.llm_dispute.key(),
        switchboard_program: Pubkey::default(),
        switchboard_queue: Pubkey::default(),
        switchboard_feed: Pubkey::default(),
        switchboard_feed_hash: [0; 32],
        switchboard_quote: None,
        switchboard_quote_slot: None,
        max_staleness_slots: 0,
        prompt_hash: [0; 32],
        variable_overrides_hash: None,
        response_hash: None,
        evidence_hash: None,
        outcome_code: None,
        outcome: None,
        requested_at: now,
        resolved_at: None,
        challenge_deadline: None,
        bump: ctx.bumps.llm_resolution_round,
    });

    let assertion = &mut ctx.accounts.assertion;
    assertion.state = AssertionState::PendingLlm;
    assertion.dispute_count = 1;
    assertion.llm_dispute = Some(ctx.accounts.llm_dispute.key());
    assertion.llm_resolution_round = Some(llm_round_key);

    Ok(())
}
