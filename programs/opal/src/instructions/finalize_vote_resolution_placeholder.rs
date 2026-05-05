use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_RESOLVED, ASSERTION_STATE_VOTING, BOND_VAULT_SEED,
        LLM_DISPUTE_SEED, OUTCOME_TRUE, PROTOCOL_CONFIG_SEED, VOTE_DISPUTE_SEED, VOTE_ROUND_SEED,
    },
    errors::OpalError,
    state::{
        AssertionAccount, LlmDisputeAccount, ProtocolConfig, VoteDisputeAccount,
        VoteResolutionRound,
    },
    utils::{checked_bps, is_outcome_set, is_timestamp_set, validate_outcome_code},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct FinalizeVoteResolutionPlaceholderArgs {
    pub outcome_code: u8,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum StageWinner {
    Asserter,
    LlmDisputer,
}

#[derive(Accounts)]
pub struct FinalizeVoteResolutionPlaceholder<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,

    // Boxed because standard Anchor Account<'info, T> (non-zero-copy) lives on the
    // stack, and with 11 accounts we risk exceeding Solana's ~4KB stack frame limit.
    pub pusd_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [ASSERTION_SEED, assertion.load()?.id.as_ref()],
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
        seeds = [VOTE_DISPUTE_SEED, assertion.key().as_ref()],
        bump = vote_dispute.load()?.bump,
    )]
    pub vote_dispute: AccountLoader<'info, VoteDisputeAccount>,

    #[account(
        mut,
        seeds = [VOTE_ROUND_SEED, assertion.key().as_ref()],
        bump = vote_resolution_round.load()?.bump,
    )]
    pub vote_resolution_round: AccountLoader<'info, VoteResolutionRound>,

    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, assertion.load()?.id.as_ref()],
        bump,
        token::mint = pusd_mint,
        token::authority = assertion,
    )]
    pub bond_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = pusd_mint,
    )]
    pub asserter_pusd: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = pusd_mint,
    )]
    pub llm_disputer_pusd: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = pusd_mint,
    )]
    pub vote_disputer_pusd: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = pusd_mint,
    )]
    pub treasury_pusd: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<FinalizeVoteResolutionPlaceholder>,
    args: FinalizeVoteResolutionPlaceholderArgs,
) -> Result<()> {
    let assertion = ctx.accounts.assertion.load()?;
    let llm_dispute = ctx.accounts.llm_dispute.load()?;
    let vote_dispute = ctx.accounts.vote_dispute.load()?;
    let vote_round = ctx.accounts.vote_resolution_round.load()?;
    let protocol_config = ctx.accounts.protocol_config.load()?;

    require!(
        assertion.state == ASSERTION_STATE_VOTING,
        OpalError::InvalidState
    );
    require!(
        !is_outcome_set(llm_dispute.settlement_resolution),
        OpalError::AlreadySettled
    );
    require!(
        !is_outcome_set(vote_dispute.settlement_resolution),
        OpalError::AlreadySettled
    );
    require!(
        llm_dispute.assertion == ctx.accounts.assertion.key(),
        OpalError::AssertionLinkMismatch
    );
    require!(
        vote_dispute.assertion == ctx.accounts.assertion.key(),
        OpalError::AssertionLinkMismatch
    );
    require!(
        vote_round.assertion == ctx.accounts.assertion.key(),
        OpalError::AssertionLinkMismatch
    );
    require!(
        vote_round.dispute == ctx.accounts.vote_dispute.key(),
        OpalError::RoundLinkMismatch
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        is_timestamp_set(vote_round.voting_deadline),
        OpalError::VoteNotOpen
    );
    require!(
        now >= vote_round.voting_deadline,
        OpalError::VoteWindowNotClosed
    );

    let final_outcome = validate_outcome_code(args.outcome_code)?;

    let assertion_bond = assertion.assertion_bond_amount_pusd;
    let llm_bond = llm_dispute.bond_amount_pusd;
    let vote_bond = vote_dispute.bond_amount_pusd;

    let required_vault = assertion_bond
        .checked_add(llm_bond)
        .ok_or(OpalError::MathOverflow)?
        .checked_add(vote_bond)
        .ok_or(OpalError::MathOverflow)?;
    require!(
        ctx.accounts.bond_vault.amount >= required_vault,
        OpalError::InsufficientVaultBalance
    );

    require!(
        ctx.accounts.asserter_pusd.owner == assertion.asserter,
        OpalError::InvalidAsserterTokenAccount
    );
    require!(
        ctx.accounts.llm_disputer_pusd.owner == llm_dispute.disputer,
        OpalError::InvalidDisputerTokenAccount
    );
    require!(
        ctx.accounts.vote_disputer_pusd.owner == vote_dispute.disputer,
        OpalError::InvalidDisputerTokenAccount
    );
    require!(
        ctx.accounts.treasury_pusd.key() == protocol_config.treasury,
        OpalError::InvalidTreasuryAccount
    );

    let llm_dispute_correct = final_outcome != OUTCOME_TRUE;
    let vote_dispute_correct = final_outcome != vote_dispute.challenged_llm_resolution;

    let (mut asserter_payout, mut llm_disputer_payout, stage_a_fee, stage_winner) =
        if llm_dispute_correct {
            let fee = checked_bps(assertion_bond, protocol_config.protocol_fee_bps)?;
            let payout = llm_bond
                .checked_add(
                    assertion_bond
                        .checked_sub(fee)
                        .ok_or(OpalError::MathOverflow)?,
                )
                .ok_or(OpalError::MathOverflow)?;
            (0, payout, fee, StageWinner::LlmDisputer)
        } else {
            let fee = checked_bps(llm_bond, protocol_config.protocol_fee_bps)?;
            let payout = assertion_bond
                .checked_add(llm_bond.checked_sub(fee).ok_or(OpalError::MathOverflow)?)
                .ok_or(OpalError::MathOverflow)?;
            (payout, 0, fee, StageWinner::Asserter)
        };

    let (vote_disputer_payout, stage_b_fee, stage_winner_bonus) = if vote_dispute_correct {
        (vote_bond, 0, 0)
    } else {
        let fee = checked_bps(vote_bond, protocol_config.protocol_fee_bps)?;
        let bonus = vote_bond.checked_sub(fee).ok_or(OpalError::MathOverflow)?;
        (0, fee, bonus)
    };

    if stage_winner_bonus > 0 {
        match stage_winner {
            StageWinner::Asserter => {
                asserter_payout = asserter_payout
                    .checked_add(stage_winner_bonus)
                    .ok_or(OpalError::MathOverflow)?;
            }
            StageWinner::LlmDisputer => {
                llm_disputer_payout = llm_disputer_payout
                    .checked_add(stage_winner_bonus)
                    .ok_or(OpalError::MathOverflow)?;
            }
        }
    }

    let treasury_fee = stage_a_fee
        .checked_add(stage_b_fee)
        .ok_or(OpalError::MathOverflow)?;

    let assertion_id = assertion.id;
    let bump = assertion.bump;
    drop(assertion);
    drop(llm_dispute);
    drop(vote_dispute);
    drop(vote_round);
    drop(protocol_config);

    let signer_seeds: &[&[u8]] = &[ASSERTION_SEED, assertion_id.as_ref(), &[bump]];

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

    if vote_disputer_payout > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bond_vault.to_account_info(),
                    to: ctx.accounts.vote_disputer_pusd.to_account_info(),
                    authority: ctx.accounts.assertion.to_account_info(),
                },
                &[signer_seeds],
            ),
            vote_disputer_payout,
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

    // PLACEHOLDER: In the real flow both disputes settle to the same final_outcome
    // because vote resolution is the ultimate arbiter. If we ever support divergent
    // settlements (e.g., partial slashing) these lines will change.
    let mut llm_dispute = ctx.accounts.llm_dispute.load_mut()?;
    llm_dispute.settlement_resolution = final_outcome;

    let mut vote_dispute = ctx.accounts.vote_dispute.load_mut()?;
    vote_dispute.settlement_resolution = final_outcome;

    let vote_round = &mut ctx.accounts.vote_resolution_round.load_mut()?;
    vote_round.final_outcome = final_outcome;
    vote_round.committed = crate::constants::BOOL_TRUE;
    vote_round.delegated = crate::constants::BOOL_FALSE; // placeholder: voting is "done" but no real commit happened

    let mut assertion = ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_RESOLVED;
    assertion.outcome = final_outcome;
    assertion.finalized_at = now;

    Ok(())
}
