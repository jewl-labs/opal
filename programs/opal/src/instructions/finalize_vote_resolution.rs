use crate::{
    constants::{
        ASSERTION_SEED, ASSERTION_STATE_RESOLVED, ASSERTION_STATE_VOTING, BOND_VAULT_SEED,
        BOOL_TRUE, LLM_DISPUTE_SEED, OUTCOME_TRUE, OUTCOME_UNRESOLVABLE, PROTOCOL_CONFIG_SEED,
        VOTE_DISPUTE_SEED, VOTE_ROUND_SEED, VOTE_VAULT_SEED,
    },
    errors::OpalError,
    state::{
        AssertionAccount, LlmDisputeAccount, ProtocolConfig, VoteDisputeAccount,
        VoteResolutionRound,
    },
    utils::{checked_bps, is_outcome_set, is_timestamp_set},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(Clone, Copy, PartialEq, Eq)]
enum StageWinner {
    Asserter,
    LlmDisputer,
}

/// Accounts for the `finalize_vote_resolution` instruction.
#[derive(Accounts)]
pub struct FinalizeVoteResolution<'info> {
    /// Permissionless — any signer can finalize once the reveal window has closed.
    pub caller: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump,
    )]
    pub protocol_config: AccountLoader<'info, ProtocolConfig>,

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

    /// Holds asserter + disputer PUSD bonds.
    #[account(
        mut,
        seeds = [BOND_VAULT_SEED, assertion.load()?.id.as_ref()],
        bump,
        token::mint = pusd_mint,
        token::authority = assertion,
    )]
    pub bond_vault: Box<Account<'info, TokenAccount>>,

    /// Holds voter PUSD bonds. The treasury cut is transferred out here; the rest stays for claims.
    #[account(
        mut,
        seeds = [VOTE_VAULT_SEED, vote_resolution_round.key().as_ref()],
        bump,
        token::mint = pusd_mint,
        token::authority = vote_resolution_round,
    )]
    pub vote_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, token::mint = pusd_mint)]
    pub asserter_pusd: Box<Account<'info, TokenAccount>>,

    #[account(mut, token::mint = pusd_mint)]
    pub llm_disputer_pusd: Box<Account<'info, TokenAccount>>,

    #[account(mut, token::mint = pusd_mint)]
    pub vote_disputer_pusd: Box<Account<'info, TokenAccount>>,

    #[account(mut, token::mint = pusd_mint)]
    pub treasury_pusd: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

/// Finalizes vote resolution: determines the outcome from vote tallies, distributes all bonds.
pub fn handler(ctx: Context<FinalizeVoteResolution>) -> Result<()> {
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

    let now = Clock::get()?.unix_timestamp;
    require!(
        is_timestamp_set(vote_round.reveal_deadline),
        OpalError::VoteNotOpen
    );
    require!(
        now >= vote_round.reveal_deadline,
        OpalError::VoteWindowNotClosed
    );

    // 1. Determine the winning outcome
    let votes = &vote_round.aggregate_votes;
    let (winning_weight, raw_outcome) = [
        (votes.true_weight, 0u8),
        (votes.false_weight, 1u8),
        (votes.too_early_weight, 2u8),
        (votes.unresolvable_weight, 3u8),
    ]
    .into_iter()
    .max_by_key(|(w, _)| *w)
    .unwrap();

    // 2. Supermajority check — no quorum or tie → UNRESOLVABLE
    let final_outcome = if vote_round.total_valid_weight == 0 {
        OUTCOME_UNRESOLVABLE
    } else {
        let threshold_num = (vote_round.total_valid_weight as u128)
            .checked_mul(protocol_config.supermajority_bps as u128)
            .ok_or(OpalError::MathOverflow)?;
        let threshold = threshold_num
            .checked_div(10_000)
            .ok_or(OpalError::MathOverflow)?;
        if winning_weight >= threshold {
            raw_outcome
        } else {
            OUTCOME_UNRESOLVABLE
        }
    };

    // 3. Stage A: asserter vs LLM disputer (same logic as finalize_llm_resolution)
    let assertion_bond = assertion.assertion_bond_amount_pusd;
    let llm_bond = llm_dispute.bond_amount_pusd;
    let vote_bond = vote_dispute.bond_amount_pusd;
    let total_vote_bond = vote_round.total_vote_bond;
    let majority_bond = if final_outcome == OUTCOME_UNRESOLVABLE {
        0u128
    } else {
        winning_weight
    };

    let required_vault = assertion_bond
        .checked_add(llm_bond)
        .ok_or(OpalError::MathOverflow)?
        .checked_add(vote_bond)
        .ok_or(OpalError::MathOverflow)?;
    require!(
        ctx.accounts.bond_vault.amount >= required_vault,
        OpalError::InsufficientVaultBalance
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
            (0u64, payout, fee, StageWinner::LlmDisputer)
        } else {
            let fee = checked_bps(llm_bond, protocol_config.protocol_fee_bps)?;
            let payout = assertion_bond
                .checked_add(
                    llm_bond.checked_sub(fee).ok_or(OpalError::MathOverflow)?,
                )
                .ok_or(OpalError::MathOverflow)?;
            (payout, 0u64, fee, StageWinner::Asserter)
        };

    let (vote_disputer_payout, stage_b_fee, stage_winner_bonus) = if vote_dispute_correct {
        (vote_bond, 0u64, 0u64)
    } else {
        let fee = checked_bps(vote_bond, protocol_config.protocol_fee_bps)?;
        let bonus = vote_bond.checked_sub(fee).ok_or(OpalError::MathOverflow)?;
        (0u64, fee, bonus)
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

    let bond_treasury_fee = stage_a_fee
        .checked_add(stage_b_fee)
        .ok_or(OpalError::MathOverflow)?;

    // 4. Voter reward pool: minority + unrevealed bonds, split between voters and treasury
    //    slashed = total_vote_bond - majority_bond (minority revealed + all unrevealed)
    let slashed = total_vote_bond
        .checked_sub(majority_bond)
        .ok_or(OpalError::MathOverflow)?;
    let voter_reward_pool_128 = slashed
        .checked_mul(protocol_config.voter_reward_share_bps as u128)
        .ok_or(OpalError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(OpalError::MathOverflow)?;
    let voter_reward_pool =
        u64::try_from(voter_reward_pool_128).map_err(|_| error!(OpalError::MathOverflow))?;
    let vote_treasury_cut = u64::try_from(
        slashed
            .checked_sub(voter_reward_pool_128)
            .ok_or(OpalError::MathOverflow)?,
    )
    .map_err(|_| error!(OpalError::MathOverflow))?;

    // Collect data needed for signer seeds before drops
    let assertion_id = assertion.id;
    let assertion_bump = assertion.bump;
    let vote_round_bump = vote_round.bump;
    drop(assertion);
    drop(llm_dispute);
    drop(vote_dispute);
    drop(vote_round);
    drop(protocol_config);

    let bond_signer_seeds: &[&[u8]] = &[ASSERTION_SEED, assertion_id.as_ref(), &[assertion_bump]];
    let assertion_key = ctx.accounts.assertion.key();
    let vote_signer_seeds: &[&[u8]] =
        &[VOTE_ROUND_SEED, assertion_key.as_ref(), &[vote_round_bump]];

    // 5. Distribute bond vault (asserter / LLM disputer / vote disputer / treasury)
    if asserter_payout > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bond_vault.to_account_info(),
                    to: ctx.accounts.asserter_pusd.to_account_info(),
                    authority: ctx.accounts.assertion.to_account_info(),
                },
                &[bond_signer_seeds],
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
                &[bond_signer_seeds],
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
                &[bond_signer_seeds],
            ),
            vote_disputer_payout,
        )?;
    }
    if bond_treasury_fee > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bond_vault.to_account_info(),
                    to: ctx.accounts.treasury_pusd.to_account_info(),
                    authority: ctx.accounts.assertion.to_account_info(),
                },
                &[bond_signer_seeds],
            ),
            bond_treasury_fee,
        )?;
    }

    // 6. Transfer treasury cut from vote vault (majority bonds + reward pool stay for claims)
    if vote_treasury_cut > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vote_vault.to_account_info(),
                    to: ctx.accounts.treasury_pusd.to_account_info(),
                    authority: ctx.accounts.vote_resolution_round.to_account_info(),
                },
                &[vote_signer_seeds],
            ),
            vote_treasury_cut,
        )?;
    }

    // 7. Write results
    let mut llm_dispute = ctx.accounts.llm_dispute.load_mut()?;
    llm_dispute.settlement_resolution = final_outcome;

    let mut vote_dispute = ctx.accounts.vote_dispute.load_mut()?;
    vote_dispute.settlement_resolution = final_outcome;

    let vote_round = &mut ctx.accounts.vote_resolution_round.load_mut()?;
    vote_round.final_outcome = final_outcome;
    vote_round.voter_reward_pool = voter_reward_pool as u128;
    vote_round.committed = BOOL_TRUE;

    let mut assertion = ctx.accounts.assertion.load_mut()?;
    assertion.state = ASSERTION_STATE_RESOLVED;
    assertion.outcome = final_outcome;
    assertion.finalized_at = now;

    Ok(())
}
