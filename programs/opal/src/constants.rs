use anchor_lang::prelude::constant;

pub const BPS_DENOMINATOR: u64 = 10_000;

#[constant]
pub const PROTOCOL_CONFIG_SEED: &[u8] = b"protocol_config";
#[constant]
pub const ASSERTION_SEED: &[u8] = b"assertion";
#[constant]
pub const BOND_VAULT_SEED: &[u8] = b"bond_vault";
#[constant]
pub const LLM_DISPUTE_SEED: &[u8] = b"llm_dispute";
#[constant]
pub const VOTE_DISPUTE_SEED: &[u8] = b"vote_dispute";
#[constant]
pub const LLM_ROUND_SEED: &[u8] = b"llm_round";

pub const MAX_STATEMENT_LEN: usize = 280;
pub const MAX_AUXILIARY_HASH_LEN: usize = 128;

#[constant]
pub const ASSERTION_STATE_ASSERTED: u8 = 0;
#[constant]
pub const ASSERTION_STATE_PENDING_LLM: u8 = 1;
#[constant]
pub const ASSERTION_STATE_ASSERTED_LLM: u8 = 2;
#[constant]
pub const ASSERTION_STATE_PENDING_VOTE: u8 = 3;
#[constant]
pub const ASSERTION_STATE_RESOLVED: u8 = 5;

#[constant]
pub const OUTCOME_TRUE: u8 = 0;
#[constant]
pub const OUTCOME_FALSE: u8 = 1;
#[constant]
pub const OUTCOME_TOO_EARLY: u8 = 2;
#[constant]
pub const OUTCOME_UNRESOLVABLE: u8 = 3;
#[constant]
pub const OUTCOME_NONE: u8 = 255;

pub const TIMESTAMP_NONE: i64 = 0;
