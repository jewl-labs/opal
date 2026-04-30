use anchor_lang::prelude::*;

pub const MAX_STATEMENT_LEN: usize = 280;
pub const AUXILIARY_HASH_LEN: usize = 64;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug, InitSpace)]
pub enum AssertionState {
    /// Liveness window open; optimistic default is True.
    Asserted,
    PendingLLM,
    /// LLM verdict posted; challenge window open.
    AssertedLLM,
    PendingVote,
    Voting,
    /// Terminal — outcome is set and immutable.
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug, InitSpace)]
pub enum ResolutionOutcome {
    True,
    False,
    /// Ground truth does not yet exist at resolution time.
    TooEarly,
    Unresolvable,
}

impl ResolutionOutcome {
    pub fn from_code(code: u8) -> Option<Self> {
        match code {
            0 => Some(ResolutionOutcome::True),
            1 => Some(ResolutionOutcome::False),
            2 => Some(ResolutionOutcome::TooEarly),
            3 => Some(ResolutionOutcome::Unresolvable),
            _ => None,
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct AssertionAccount {
    pub id: Pubkey,
    pub asserter: Pubkey,
    #[max_len(280)]
    pub statement: String,
    #[max_len(64)]
    pub auxiliary_hash: String,
    pub assertion_bond: u64,
    pub bond_vault: Pubkey,
    pub state: AssertionState,
    pub liveness_deadline: i64,
    pub outcome: Option<ResolutionOutcome>,
    pub finalized_at: Option<i64>,
    /// 0 = never disputed, 1 = LLM phase, 2 = vote phase.
    pub dispute_count: u8,
    pub llm_dispute: Option<Pubkey>,
    pub vote_dispute: Option<Pubkey>,
    pub llm_resolution_round: Option<Pubkey>,
    pub vote_resolution_round: Option<Pubkey>,
    pub bump: u8,
}
