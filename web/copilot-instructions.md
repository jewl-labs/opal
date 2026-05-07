# Copilot Instructions

- Treat Opal as a Solana-native optimistic oracle for natural-language statements.
- Preserve the architecture semantics from the protocol docs: `Asserted` defaults to true, `Resolved` is terminal, and `AssertionAccount.outcome` should only matter after resolution.
- Keep zero-copy account constraints intact in any protocol-facing code: primitive fields only, no `Option`, `bool`, or enums inside packed accounts.
- Use stablecoin language consistently in UI copy even when current field names still say `pusd`.
- Prefer concise architecture-first copy for the landing page and do not reintroduce placeholder marketing text that conflicts with the resolution flow.
