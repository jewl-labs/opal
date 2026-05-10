use anchor_lang::prelude::*;

// !TBD: #[derive(Default)] on a zero_copy sub-struct is fragile. If a non-zero default
// is ever added, Default::default() would diverge from zero-copy initialization.
/// Aggregated vote weights per outcome for a single vote round.
#[repr(C, packed)]
#[zero_copy(unsafe)]
#[derive(Default)]
pub struct VotesPerOutcome {
    pub true_weight: u128,
    pub false_weight: u128,
    pub too_early_weight: u128,
    pub unresolvable_weight: u128,
}

/// Tracks voting state, MagicBlock delegation, deadlines, and the final outcome for a vote round.
#[repr(C, packed)]
#[account(zero_copy(unsafe))]
pub struct VoteResolutionRound {
    pub assertion: Pubkey,
    pub dispute: Pubkey,
    pub magicblock_validator: Pubkey,
    pub permission_account: Pubkey,
    pub delegated_vote_state: Pubkey,
    // !TBD: delegated/committed lifecycle is semantically confusing (FALSE→TRUE→FALSE).
    // Consider consolidating into a single vote_phase enum-like field.
    pub delegated: u8,
    pub committed: u8,
    pub voting_starts_at: i64,
    pub voting_deadline: i64,
    pub reveal_deadline: i64,
    pub total_valid_weight: u128,
    /// Sum of all voter bonds locked at cast time (revealed or not).
    pub total_vote_bond: u128,
    /// PUSD available for majority voter reward claims, set at finalization.
    pub voter_reward_pool: u128,
    pub aggregate_votes: VotesPerOutcome,
    pub final_outcome: u8,
    pub bump: u8,
}
