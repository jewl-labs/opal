pub const BPS_DENOMINATOR: u64 = 10_000;

pub const PROTOCOL_CONFIG_SEED: &[u8] = b"protocol_config";
pub const ASSERTION_SEED: &[u8] = b"assertion";
pub const BOND_VAULT_SEED: &[u8] = b"bond_vault";
pub const LLM_DISPUTE_SEED: &[u8] = b"llm_dispute";
pub const VOTE_DISPUTE_SEED: &[u8] = b"vote_dispute";
pub const LLM_ROUND_SEED: &[u8] = b"llm_round";
pub const VOTE_ROUND_SEED: &[u8] = b"vote_round";

pub const MAX_STATEMENT_LEN: usize = 280;
pub const MAX_AUXILIARY_HASH_LEN: usize = 128;

pub const COUNCIL_SIZE: usize = 3;
pub const MAX_FEED_STALE_SLOTS: u32 = 250; // ~100 s at 400 ms/slot
pub const MIN_FEED_SAMPLES: u32 = 3;

pub const ASSERTION_STATE_ASSERTED: u8 = 0;
pub const ASSERTION_STATE_PENDING_LLM: u8 = 1;
pub const ASSERTION_STATE_ASSERTED_LLM: u8 = 2;
pub const ASSERTION_STATE_PENDING_VOTE: u8 = 3;
pub const ASSERTION_STATE_VOTING: u8 = 4;
pub const ASSERTION_STATE_RESOLVED: u8 = 5;

pub const OUTCOME_TRUE: u8 = 0;
pub const OUTCOME_FALSE: u8 = 1;
pub const OUTCOME_TOO_EARLY: u8 = 2;
pub const OUTCOME_UNRESOLVABLE: u8 = 3;
pub const OUTCOME_NONE: u8 = 255;

pub const TIMESTAMP_NONE: i64 = 0;
pub const BOOL_FALSE: u8 = 0;
pub const BOOL_TRUE: u8 = 1;
