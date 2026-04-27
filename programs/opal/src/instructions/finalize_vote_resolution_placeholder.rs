use crate::{
    constants::{
        ASSERTION_SEED, BOND_VAULT_SEED, LLM_DISPUTE_SEED, PROTOCOL_CONFIG_SEED, VOTE_DISPUTE_SEED,
        VOTE_ROUND_SEED,
    },
    errors::OpalError,
    state::{
        AssertionAccount, AssertionState, LlmDisputeAccount, ProtocolConfig, ResolutionOutcome,
        VoteDisputeAccount, VoteResolutionRound,
    },
    utils::{checked_bps, map_outcome_code},
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
        bump = protocol_config.bump,
        has_one = authority @ OpalError::Unauthorized,
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
        seeds = [VOTE_DISPUTE_SEED, assertion.key().as_ref()],
        bump = vote_dispute.bump,
        constraint = vote_dispute.assertion == assertion.key() @ OpalError::AssertionLinkMismatch,
    )]
    pub vote_dispute: Account<'info, VoteDisputeAccount>,

    #[account(
        mut,
        seeds = [VOTE_ROUND_SEED, assertion.key().as_ref()],
        bump = vote_resolution_round.bump,
        constraint = vote_resolution_round.assertion == assertion.key() @ OpalError::AssertionLinkMismatch,
        constraint = vote_resolution_round.dispute == vote_dispute.key() @ OpalError::RoundLinkMismatch,
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
        token::mint = pusd_mint,
        constraint = vote_disputer_pusd.owner == vote_dispute.disputer @ OpalError::InvalidDisputerTokenAccount,
    )]
    pub vote_disputer_pusd: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = protocol_config.treasury @ OpalError::InvalidTreasuryAccount,
        token::mint = pusd_mint,
    )]
    pub treasury_pusd: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<FinalizeVoteResolutionPlaceholder>,
    args: FinalizeVoteResolutionPlaceholderArgs,
) -> Result<()> {
    require!(
        ctx.accounts.assertion.state == AssertionState::Voting,
        OpalError::InvalidState
    );
    require!(
        ctx.accounts.llm_dispute.settlement_resolution.is_none(),
        OpalError::AlreadySettled
    );
    require!(
        ctx.accounts.vote_dispute.settlement_resolution.is_none(),
        OpalError::AlreadySettled
    );

    let now = Clock::get()?.unix_timestamp;
    let voting_deadline = ctx
        .accounts
        .vote_resolution_round
        .voting_deadline
        .ok_or(OpalError::VoteNotOpen)?;
    require!(now >= voting_deadline, OpalError::VoteWindowNotClosed);

    let final_outcome = map_outcome_code(args.outcome_code)?;

    let assertion_bond = ctx.accounts.assertion.assertion_bond_amount_pusd;
    let llm_bond = ctx.accounts.llm_dispute.bond_amount_pusd;
    let vote_bond = ctx.accounts.vote_dispute.bond_amount_pusd;

    let required_vault = assertion_bond
        .checked_add(llm_bond)
        .ok_or(OpalError::MathOverflow)?
        .checked_add(vote_bond)
        .ok_or(OpalError::MathOverflow)?;
    require!(
        ctx.accounts.bond_vault.amount >= required_vault,
        OpalError::InsufficientVaultBalance
    );

    let llm_dispute_correct = final_outcome != ResolutionOutcome::True;
    let vote_dispute_correct = final_outcome != ctx.accounts.vote_dispute.challenged_llm_resolution;

    let (mut asserter_payout, mut llm_disputer_payout, stage_a_fee, stage_winner) =
        if llm_dispute_correct {
            let fee = checked_bps(assertion_bond, ctx.accounts.protocol_config.protocol_fee_bps)?;
            let payout = llm_bond
                .checked_add(assertion_bond.checked_sub(fee).ok_or(OpalError::MathOverflow)?)
                .ok_or(OpalError::MathOverflow)?;
            (0, payout, fee, StageWinner::LlmDisputer)
        } else {
            let fee = checked_bps(llm_bond, ctx.accounts.protocol_config.protocol_fee_bps)?;
            let payout = assertion_bond
                .checked_add(llm_bond.checked_sub(fee).ok_or(OpalError::MathOverflow)?)
                .ok_or(OpalError::MathOverflow)?;
            (payout, 0, fee, StageWinner::Asserter)
        };

    let (vote_disputer_payout, stage_b_fee, stage_winner_bonus) = if vote_dispute_correct {
        (vote_bond, 0, 0)
    } else {
        let fee = checked_bps(vote_bond, ctx.accounts.protocol_config.protocol_fee_bps)?;
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

    ctx.accounts.llm_dispute.settlement_resolution = Some(final_outcome);

    ctx.accounts.vote_dispute.settlement_resolution = Some(final_outcome);

    let vote_round = &mut ctx.accounts.vote_resolution_round;
    vote_round.final_outcome = Some(final_outcome);
    vote_round.committed = true;
    vote_round.delegated = false;

    let assertion = &mut ctx.accounts.assertion;
    assertion.state = AssertionState::Resolved;
    assertion.outcome = Some(final_outcome);
    assertion.finalized_at = Some(now);

    Ok(())
}
