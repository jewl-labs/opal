use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum AssertionState {
    Asserted,
    PendingLLM,
    AssertedLLM,
    PendingVote,
    Voting,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ResolutionOutcome {
    True,
    False,
    TooEarly,
    Unresolvable,
}

#[account]
#[derive(InitSpace)]
pub struct AssertionAccount {
    /// Client-supplied unique ID used as a PDA seed; allows one asserter to hold many assertions.
    pub assertion_id: u64,
    pub asserter: Pubkey,
    #[max_len(512)]
    pub statement: String,
    /// SHA-256 of the offchain auxiliary text; the text itself lives off-chain.
    pub auxiliary_hash: [u8; 32],
    pub bond_vault: Pubkey,
    pub bond_amount: u64,
    pub state: AssertionState,
    pub liveness_deadline: i64,
    pub outcome: Option<ResolutionOutcome>,
    pub finalized_at: Option<i64>,
    pub dispute_count: u8,
    pub llm_dispute: Option<Pubkey>,
    pub llm_resolution_round: Option<Pubkey>,
    pub bump: u8,
}
