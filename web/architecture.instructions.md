# Architecture Instructions

- Keep the optimistic oracle state machine aligned with the docs: `Asserted` -> `PendingLLM` -> `AssertedLLM` -> `PendingVote` -> `Voting` -> `Resolved`.
- Do not add tentative resolution storage back into `AssertionAccount`.
- Treat unresolved states as non-final: consumers should wait for `Resolved` before irreversible settlement.
- Reserve Switchboard, Nosana, and MagicBlock integrations as placeholders unless the implementation explicitly wires them in.
- When editing landing copy, explain the protocol in terms of default truth, economically incentivized disputes, and final settlement at `Resolved`.
