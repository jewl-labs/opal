use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::errors::OpalError;
use crate::state::{
    AssertionAccount, AssertionState, LLMResolutionRound, ProtocolConfig,
    VoteDisputeAccount, VoteResolutionRound, VotesPerOutcome,
};

#[derive(Accounts)]
pub struct ChallengeLLMResolution<'info> {
    #[account(mut)]
    pub disputer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"assertion", assertion.id.as_ref()],
        bump = assertion.bump,
        constraint = assertion.state == AssertionState::AssertedLLM @ OpalError::InvalidState,
        constraint = assertion.dispute_count == 1 @ OpalError::InvalidState,
        constraint = assertion.vote_dispute.is_none() @ OpalError::AlreadyDisputed,
    )]
    pub assertion: Account<'info, AssertionAccount>,

    #[account(
        seeds = [b"llm_round", assertion.key().as_ref()],
        bump = llm_round.bump,
        constraint = llm_round.outcome.is_some() @ OpalError::InvalidState,
    )]
    pub llm_round: Account<'info, LLMResolutionRound>,

    #[account(
        init,
        payer = disputer,
        space = 8 + VoteDisputeAccount::INIT_SPACE,
        seeds = [b"vote_dispute", assertion.key().as_ref()],
        bump,
    )]
    pub vote_dispute: Account<'info, VoteDisputeAccount>,

    #[account(
        init,
        payer = disputer,
        space = 8 + VoteResolutionRound::INIT_SPACE,
        seeds = [b"vote_round", assertion.key().as_ref()],
        bump,
    )]
    pub vote_round: Account<'info, VoteResolutionRound>,

    #[account(
        mut,
        seeds = [b"bond_vault", assertion.key().as_ref()],
        bump,
        token::mint = pusd_mint,
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pusd_mint,
        token::authority = disputer,
    )]
    pub disputer_token_account: Account<'info, TokenAccount>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,

    pub pusd_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> ChallengeLLMResolution<'info> {
    pub fn challenge_llm_resolution(
        &mut self,
        bumps: &ChallengeLLMResolutionBumps,
    ) -> Result<()> {
        let clock = Clock::get()?;

        let deadline = self
            .llm_round
            .challenge_deadline
            .ok_or(OpalError::ChallengeWindowNotOpen)?;
        require!(clock.unix_timestamp <= deadline, OpalError::ChallengeWindowExpired);

        let required_bond = self
            .config
            .required_vote_dispute_bond(self.assertion.assertion_bond)
            .ok_or(OpalError::Overflow)?;

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.disputer_token_account.to_account_info(),
                    to: self.bond_vault.to_account_info(),
                    authority: self.disputer.to_account_info(),
                },
            ),
            required_bond,
        )?;

        let challenged_outcome = self
            .llm_round
            .outcome
            .clone()
            .ok_or(OpalError::InvalidState)?;

        let vd = &mut self.vote_dispute;
        vd.assertion = self.assertion.key();
        vd.disputer = self.disputer.key();
        vd.challenged_llm_resolution_round = self.llm_round.key();
        vd.challenged_llm_resolution = challenged_outcome;
        vd.bond_amount_pusd = required_bond;
        vd.created_at = clock.unix_timestamp;
        vd.resolution_round = self.vote_round.key();
        vd.settlement_resolution = None;
        vd.dispute_correct = None;
        vd.settled = false;
        vd.bump = bumps.vote_dispute;

        let vr = &mut self.vote_round;
        vr.assertion = self.assertion.key();
        vr.dispute = self.vote_dispute.key();
        vr.voting_starts_at = None;
        vr.voting_deadline = None;
        vr.reveal_deadline = None;
        vr.total_valid_weight = 0;
        vr.aggregate_votes = VotesPerOutcome::default();
        vr.final_outcome = None;
        vr.delegated = false;
        vr.committed = false;
        vr.settled = false;
        vr.bump = bumps.vote_round;

        let a = &mut self.assertion;
        a.state = AssertionState::PendingVote;
        a.dispute_count = 2;
        a.vote_dispute = Some(self.vote_dispute.key());
        a.vote_resolution_round = Some(self.vote_round.key());

        Ok(())
    }
}
