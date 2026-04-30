use anchor_lang::prelude::*;
use crate::state::ResolutionOutcome;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default, InitSpace)]
pub struct VotesPerOutcome {
    pub true_weight: u128,
    pub false_weight: u128,
    pub too_early_weight: u128,
    pub unresolvable_weight: u128,
}

impl VotesPerOutcome {
    pub fn add(&mut self, outcome: &ResolutionOutcome, weight: u128) -> Option<()> {
        match outcome {
            ResolutionOutcome::True => {
                self.true_weight = self.true_weight.checked_add(weight)?;
            }
            ResolutionOutcome::False => {
                self.false_weight = self.false_weight.checked_add(weight)?;
            }
            ResolutionOutcome::TooEarly => {
                self.too_early_weight = self.too_early_weight.checked_add(weight)?;
            }
            ResolutionOutcome::Unresolvable => {
                self.unresolvable_weight = self.unresolvable_weight.checked_add(weight)?;
            }
        }
        Some(())
    }

    pub fn leading(&self) -> Option<(ResolutionOutcome, u128)> {
        let candidates = [
            (ResolutionOutcome::True, self.true_weight),
            (ResolutionOutcome::False, self.false_weight),
            (ResolutionOutcome::TooEarly, self.too_early_weight),
            (ResolutionOutcome::Unresolvable, self.unresolvable_weight),
        ];
        candidates
            .into_iter()
            .max_by_key(|(_, w)| *w)
            .filter(|(_, w)| *w > 0)
    }
}

#[account]
#[derive(InitSpace)]
pub struct LLMResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    pub switchboard_feed: Pubkey,
    pub switchboard_feed_hash: [u8; 32],
    pub switchboard_quote_slot: Option<u64>,
    pub max_staleness_slots: u64,
    pub prompt_hash: [u8; 32],
    pub variable_overrides_hash: Option<[u8; 32]>,
    pub response_hash: Option<[u8; 32]>,
    pub evidence_hash: Option<[u8; 32]>,
    pub outcome_code: Option<u8>,
    pub outcome: Option<ResolutionOutcome>,
    pub requested_at: i64,
    pub resolved_at: Option<i64>,
    pub challenge_deadline: Option<i64>,
    pub settled: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VoteResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    pub voting_starts_at: Option<i64>,
    pub voting_deadline: Option<i64>,
    pub reveal_deadline: Option<i64>,
    pub total_valid_weight: u128,
    pub aggregate_votes: VotesPerOutcome,
    pub final_outcome: Option<ResolutionOutcome>,
    pub delegated: bool,
    pub committed: bool,
    pub settled: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub vote_round: Pubkey,
    pub voter: Pubkey,
    pub locked_opal: u64,
    /// sha256(choice_byte || nonce) — conceals vote direction until reveal.
    pub commitment: [u8; 32],
    pub choice: Option<ResolutionOutcome>,
    pub voted_at: i64,
    pub revealed_at: Option<i64>,
    pub settled: bool,
    pub bump: u8,
}
