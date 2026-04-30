use anchor_lang::prelude::*;

#[error_code]
pub enum OpalError {
    #[msg("Assertion is not in the required state for this instruction")]
    InvalidState,
    #[msg("The liveness window has not yet expired")]
    LivenessWindowActive,
    #[msg("The liveness window has already expired; dispute is no longer allowed")]
    LivenessWindowExpired,
    #[msg("The LLM challenge window has not yet expired")]
    ChallengeWindowActive,
    #[msg("Bond amount is below the protocol minimum")]
    BondTooSmall,
    #[msg("Caller is not the designated oracle authority")]
    Unauthorized,
    #[msg("Outcome code must be 0 (True), 1 (False), 2 (TooEarly), or 3 (Unresolvable)")]
    InvalidOutcomeCode,
    #[msg("Feed hash does not match the value committed at dispute time")]
    FeedHashMismatch,
    #[msg("Switchboard quote is too stale")]
    StaleFeed,
    #[msg("No feed data in the Switchboard quote")]
    NoFeedData,
    #[msg("Bond has already been settled")]
    AlreadySettled,
    #[msg("LLM resolution outcome is not set")]
    MissingOutcome,
    #[msg("LLM challenge deadline is not set")]
    MissingChallengeDeadline,
    #[msg("Switchboard oracle quote verification failed")]
    InvalidQuote,
    #[msg("Feed account does not match the expected switchboard feed")]
    InvalidFeed,
}
