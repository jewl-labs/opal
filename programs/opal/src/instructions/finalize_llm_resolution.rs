use crate::{
    constants::{
        ASSERTION_SEED, BOND_VAULT_SEED, LLM_DISPUTE_SEED, LLM_ROUND_SEED, PROTOCOL_CONFIG_SEED,
    },
    errors::OpalError,
    state::{
        AssertionAccount, AssertionState, LlmDisputeAccount, LlmResolutionRound, ProtocolConfig,
        ResolutionOutcome,
    },
    utils::checked_bps,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct FinalizeLlmResolution<'info> {
    pub finalizer: Signer<'info>,

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
        mut,
        seeds = [LLM_DISPUTE_SEED, assertion.key().as_ref()],
        bump = llm_dispute.bump,
        constraint = llm_dispute.assertion == assertion.key() @ OpalError::AssertionLinkMismatch,
    )]
    pub llm_dispute: Account<'info, LlmDisputeAccount>,

    #[account(
        mut,
        seeds = [LLM_ROUND_SEED, assertion.key().as_ref()],
        bump = llm_resolution_round.bump,
        constraint = llm_resolution_round.assertion == assertion.key() @ OpalError::AssertionLinkMismatch,
        constraint = llm_resolution_round.dispute == llm_dispute.key() @ OpalError::RoundLinkMismatch,
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
        constraint = asserter_pusd.owner == assertion.asserter @ OpalError::InvalidAsserterTokenAccount,
    )]
    pub asserter_pusd: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pusd_mint,
        constraint = llm_disputer_pusd.owner == llm_dispute.disputer @ OpalError::InvalidDisputerTokenAccount,
    )]
    pub llm_disputer_pusd: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = protocol_config.treasury @ OpalError::InvalidTreasuryAccount,
        token::mint = pusd_mint,
    )]
    pub treasury_pusd: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FinalizeLlmResolution>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        ctx.accounts.assertion.state == AssertionState::AssertedLlm,
        OpalError::InvalidState
    );
    require!(
        ctx.accounts.assertion.vote_dispute.is_none(),
        OpalError::VoteDisputeAlreadyExists
    );
    require!(
        ctx.accounts.llm_dispute.settlement_resolution.is_none(),
        OpalError::AlreadySettled
    );

    let challenge_deadline = ctx
        .accounts
        .llm_resolution_round
        .challenge_deadline
        .ok_or(OpalError::MissingChallengeDeadline)?;
    require!(now >= challenge_deadline, OpalError::DeadlineNotReached);

    let final_outcome = ctx
        .accounts
        .llm_resolution_round
        .outcome
        .ok_or(OpalError::LlmOutcomeMissing)?;

    let assertion_bond = ctx.accounts.assertion.assertion_bond_amount_pusd;
    let llm_dispute_bond = ctx.accounts.llm_dispute.bond_amount_pusd;

    let required_vault = assertion_bond
        .checked_add(llm_dispute_bond)
        .ok_or(OpalError::MathOverflow)?;
    require!(
        ctx.accounts.bond_vault.amount >= required_vault,
        OpalError::InsufficientVaultBalance
    );

    let llm_dispute_correct = final_outcome != ResolutionOutcome::True;

    let (asserter_payout, llm_disputer_payout, treasury_fee) = if llm_dispute_correct {
        let fee = checked_bps(assertion_bond, ctx.accounts.protocol_config.protocol_fee_bps)?;
        let llm_payout = llm_dispute_bond
            .checked_add(assertion_bond.checked_sub(fee).ok_or(OpalError::MathOverflow)?)
            .ok_or(OpalError::MathOverflow)?;
        (0, llm_payout, fee)
    } else {
        let fee = checked_bps(llm_dispute_bond, ctx.accounts.protocol_config.protocol_fee_bps)?;
        let asserter_total = assertion_bond
            .checked_add(llm_dispute_bond.checked_sub(fee).ok_or(OpalError::MathOverflow)?)
            .ok_or(OpalError::MathOverflow)?;
        (asserter_total, 0, fee)
    };

    let assertion_id = ctx.accounts.assertion.id;
    let bump = [ctx.accounts.assertion.bump];
    let signer_seeds: &[&[u8]] = &[ASSERTION_SEED, assertion_id.as_ref(), &bump];

    if asserter_payout > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bond_vault.to_account_info(),
                    to: ctx.accounts.asserter_pusd.to_account_info(),
                    authority: ctx.accounts.assertion.to_account_info(),
                },
                &[signer_seeds],
            ),
            asserter_payout,
        )?;
    }

    if llm_disputer_payout > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bond_vault.to_account_info(),
                    to: ctx.accounts.llm_disputer_pusd.to_account_info(),
                    authority: ctx.accounts.assertion.to_account_info(),
                },
                &[signer_seeds],
            ),
            llm_disputer_payout,
        )?;
    }

    if treasury_fee > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bond_vault.to_account_info(),
                    to: ctx.accounts.treasury_pusd.to_account_info(),
                    authority: ctx.accounts.assertion.to_account_info(),
                },
                &[signer_seeds],
            ),
            treasury_fee,
        )?;
    }

    ctx.accounts.llm_dispute.settlement_resolution = Some(final_outcome);

    let assertion = &mut ctx.accounts.assertion;
    assertion.state = AssertionState::Resolved;
    assertion.outcome = Some(final_outcome);
    assertion.finalized_at = Some(now);

    Ok(())
}
