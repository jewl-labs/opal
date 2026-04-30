use anchor_lang::prelude::*;

#[error_code]
pub enum OpalError {
    #[msg("Invalid assertion state for this operation")]
    InvalidState,

    #[msg("Assertion liveness deadline has not passed yet")]
    LivenessNotExpired,

    #[msg("Assertion liveness deadline has already passed")]
    LivenessExpired,

    #[msg("Assertion is already disputed")]
    AlreadyDisputed,

    #[msg("LLM challenge window has not opened yet")]
    ChallengeWindowNotOpen,

    #[msg("LLM challenge window has already expired")]
    ChallengeWindowExpired,

    #[msg("Bond amount is below the configured minimum")]
    BondTooLow,

    #[msg("Dispute bond amount does not match the required ratio")]
    BondMismatch,

    #[msg("Invalid outcome code; must be 0 (True), 1 (False), 2 (TooEarly), or 3 (Unresolvable)")]
    InvalidOutcomeCode,

    #[msg("LLM resolution has already been submitted for this round")]
    ResolutionAlreadySubmitted,

    #[msg("Switchboard feed account does not match the expected feed")]
    FeedMismatch,

    #[msg("Switchboard quote is stale; exceeds max_staleness_slots")]
    StaleQuote,
    
    #[msg("Oracle authority does not match config")]
    OracleAuthorityMismatch,

    #[msg("Vote setup window has expired; open_vote called too late")]
    VoteSetupExpired,

    #[msg("Voting window has not opened yet")]
    VotingNotStarted,

    #[msg("Voting window is still open; cannot finalize yet")]
    VotingWindowOpen,

    #[msg("Voting window has already closed")]
    VotingWindowClosed,

    #[msg("Reveal window has not opened yet")]
    RevealWindowNotOpen,
    
    #[msg("Reveal window has already expired")]
    RevealWindowExpired,

    #[msg("This voter has already cast a vote for this round")]
    AlreadyVoted,

    #[msg("This vote has already been revealed")]
    AlreadyRevealed,

    #[msg("Vote commitment does not match hash(choice || nonce)")]
    InvalidCommitment,

    #[msg("OPAL locked amount must be greater than zero")]
    InsufficientOpal,

    #[msg("Vote has already been settled")]
    AlreadySettled,

    #[msg("Vote has not been revealed yet; cannot settle")]
    VoteNotRevealed,

    #[msg("Vote round has not been finalized yet")]
    RoundNotFinalized,

    #[msg("Assertion is not yet resolved")]
    NotResolved,

    #[msg("Assertion is already resolved")]
    AlreadyResolved,

    #[msg("BPS values in config must not individually exceed 10000")]
    InvalidConfig,

    #[msg("Caller is not the protocol authority")]
    Unauthorized,

    #[msg("Statement must not be empty")]
    EmptyStatement,

    #[msg("Statement exceeds the maximum of 280 characters")]
    StatementTooLong,

    #[msg("Auxiliary hash must be exactly 64 characters (SHA-256 hex)")]
    InvalidAuxiliaryHash,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Division by zero in tally calculation")]
    DivisionByZero,
}
