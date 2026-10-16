// lib.rs glob-reexports these so `#[program]` can see each Accounts/Args type. Every module
// also exports a `handler`, so the globs overlap on that name; that is expected.
#![allow(ambiguous_glob_reexports)]

pub mod challenge_llm_resolution;
pub mod create_assertion;
pub mod dispute_assertion;
pub mod finalize_llm_resolution;
pub mod finalize_undisputed;
pub mod initialize_protocol_config;
pub mod submit_llm_resolution;

pub use challenge_llm_resolution::*;
pub use create_assertion::*;
pub use dispute_assertion::*;
pub use finalize_llm_resolution::*;
pub use finalize_undisputed::*;
pub use initialize_protocol_config::*;
pub use submit_llm_resolution::*;
