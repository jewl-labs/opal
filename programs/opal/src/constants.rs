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
