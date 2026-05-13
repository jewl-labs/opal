use anchor_lang::prelude::*;

#[error_code]
pub enum OpalError {
    // State / timing
    #[msg("Invalid assertion state for this transition")]
    InvalidState,
    #[msg("Operation deadline has already passed")]
    DeadlinePassed,
    #[msg("Operation deadline has not been reached yet")]
    DeadlineNotReached,

    // Assertion / dispute
    #[msg("Assertion has already been disputed")]
    AssertionAlreadyDisputed,
    #[msg("Vote dispute already exists")]
    VoteDisputeAlreadyExists,
    #[msg("Dispute has already been settled")]
    AlreadySettled,

    // Oracle / outcome
    #[msg("LLM outcome is missing")]
    LlmOutcomeMissing,
    #[msg("Invalid outcome code")]
    InvalidOutcomeCode,
    #[msg("Switchboard oracle quote verification failed")]
    InvalidQuote,
    #[msg("Feed account or hash does not match what was committed at dispute time")]
    InvalidFeed,
    #[msg("No feed data returned in the Switchboard oracle quote")]
    NoFeedData,

    // Math
    #[msg("Math overflow")]
    MathOverflow,

    // Bond / token
    #[msg("Bond amount is below required minimum")]
    InsufficientBondAmount,
    #[msg("Insufficient balance in bond vault")]
    InsufficientVaultBalance,
    #[msg("Token mint does not match protocol config")]
    InvalidMint,
    #[msg("Invalid treasury token account")]
    InvalidTreasuryAccount,
    #[msg("Invalid asserter token account")]
    InvalidAsserterTokenAccount,
    #[msg("Invalid disputer token account")]
    InvalidDisputerTokenAccount,

    // Vote
    #[msg("Vote is not open")]
    VoteNotOpen,
    #[msg("Voting window is still open")]
    VoteWindowNotClosed,
    #[msg("Commit window has closed")]
    CommitWindowClosed,
    #[msg("Reveal window has not opened yet")]
    RevealWindowNotOpen,
    #[msg("Reveal window has closed")]
    RevealWindowClosed,
    #[msg("Reveal window has not closed yet")]
    RevealWindowNotClosed,
    #[msg("Voter has already committed a vote")]
    AlreadyCommitted,
    #[msg("Voter has already revealed their vote")]
    AlreadyRevealed,
    #[msg("Vote commit hash does not match the reveal")]
    InvalidVoteHash,
    #[msg("Vote round has not been finalized yet")]
    VoteRoundNotFinalized,
    #[msg("Vote quorum was not met")]
    QuorumNotMet,
    #[msg("Voter did not vote for the winning outcome")]
    NotWinningVoter,
    #[msg("Voter reward has already been claimed")]
    RewardAlreadyClaimed,
    #[msg("Invalid OPAL token account")]
    InvalidOpalTokenAccount,
    #[msg("Challenge deadline is missing")]
    MissingChallengeDeadline,

    // Config / auth
    #[msg("Caller is not authorized")]
    Unauthorized,
    #[msg("Protocol config invariants are invalid")]
    ConfigInvariantViolation,
    #[msg("Assertion bond minimum must be greater than zero")]
    InvalidAssertionBondMinimum,
    #[msg("Invalid window configuration")]
    InvalidWindowConfiguration,

    // MagicBlock ER
    #[msg("Account undelegation from MagicBlock ER failed")]
    UndelegationFailed,

    // Validation
    #[msg("Assertion statement exceeds max length")]
    StatementTooLong,
    #[msg("Auxiliary hash exceeds max length")]
    AuxiliaryHashTooLong,
    #[msg("Assertion and related account link mismatch")]
    AssertionLinkMismatch,
    #[msg("Resolution round link mismatch")]
    RoundLinkMismatch,
}
