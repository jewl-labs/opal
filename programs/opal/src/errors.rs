use anchor_lang::prelude::*;

#[error_code]
pub enum OpalError {
    #[msg("Invalid assertion state for this transition")]
    InvalidState,
    #[msg("Operation deadline has already passed")]
    DeadlinePassed,
    #[msg("Operation deadline has not been reached yet")]
    DeadlineNotReached,
    #[msg("Assertion has already been disputed")]
    AssertionAlreadyDisputed,
    #[msg("Vote dispute already exists")]
    VoteDisputeAlreadyExists,
    #[msg("LLM outcome is missing")]
    LlmOutcomeMissing,
    #[msg("Invalid outcome code")]
    InvalidOutcomeCode,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Bond amount is below required minimum")]
    InsufficientBondAmount,
    #[msg("Caller is not authorized")]
    Unauthorized,
    #[msg("Token mint does not match protocol config")]
    InvalidMint,
<<<<<<< HEAD
    #[msg("Protocol config invariants are invalid")]
    ConfigInvariantViolation,
    #[msg("Dispute has already been settled")]
    AlreadySettled,
=======
    #[msg("Invalid treasury token account")]
    InvalidTreasuryAccount,
    #[msg("Invalid asserter token account")]
    InvalidAsserterTokenAccount,
    #[msg("Invalid disputer token account")]
    InvalidDisputerTokenAccount,

    // Vote
>>>>>>> b01045f (update constants and add error codes for voting)
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
<<<<<<< HEAD
=======

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
>>>>>>> b01045f (update constants and add error codes for voting)
    #[msg("Assertion statement exceeds max length")]
    StatementTooLong,
    #[msg("Auxiliary hash exceeds max length")]
    AuxiliaryHashTooLong,
    #[msg("Invalid treasury token account")]
    InvalidTreasuryAccount,
    #[msg("Invalid asserter token account")]
    InvalidAsserterTokenAccount,
    #[msg("Invalid disputer token account")]
    InvalidDisputerTokenAccount,
    #[msg("Assertion and related account link mismatch")]
    AssertionLinkMismatch,
    #[msg("Resolution round link mismatch")]
    RoundLinkMismatch,
    #[msg("Insufficient balance in bond vault")]
    InsufficientVaultBalance,
    #[msg("Assertion bond minimum must be greater than zero")]
    InvalidAssertionBondMinimum,
    #[msg("Invalid window configuration")]
    InvalidWindowConfiguration,
}
