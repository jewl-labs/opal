# Resources & Reference

## Version Requirements

| Software | Version |
|----------|---------|
| Solana | 3.1.12 |
| Rust | 1.85.0 |
| Anchor | 0.32.1 |
| Node | 24.10.0 |

## Key Program IDs

| Program | Address |
|---------|---------|
| Delegation Program | `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh` |
| Magic Program | `Magic11111111111111111111111111111111111111` |
| Magic Context | `MagicContext1111111111111111111111111111111` |
| Localnet Validator | `mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev` |

## Devnet Endpoint Routing

- Use `https://devnet-router.magicblock.app/` with `getIdentity` to resolve both validator identity and the best endpoint (`fqdn`).
- Valid endpoint families are `devnet-us.magicblock.app`, `devnet-as.magicblock.app`, and `devnet-eu.magicblock.app`.
- Do not hardcode validator addresses for these endpoints.

## Rust Dependencies

```toml
[dependencies]
anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
ephemeral-rollups-sdk = { version = "0.8.5", features = ["anchor", "disable-realloc"] }

# For cranks
magicblock-magic-program-api = { version = "0.3.1", default-features = false }
bincode = "^1.3"
sha2 = "0.10"

# For VRF
ephemeral-vrf-sdk = { version = "0.2.1", features = ["anchor"] }
```

## NPM Dependencies

```json
{
  "dependencies": {
    "@solana/kit": "6.1.0",
    "solana-kite": "3.2.0",
    "@magicblock-labs/ephemeral-rollups-kit": "0.8.5"
  }
}
```

## Documentation Links

- [MagicBlock Documentation](https://docs.magicblock.gg/)
- [MagicBlock Engine Examples](https://github.com/magicblock-labs/magicblock-engine-examples)
- [Ephemeral Rollups SDK (Rust)](https://crates.io/crates/ephemeral-rollups-sdk)
- [Ephemeral VRF SDK (Rust)](https://crates.io/crates/ephemeral-vrf-sdk)
- [NPM Package](https://www.npmjs.com/package/@magicblock-labs/ephemeral-rollups-kit)
- [Private Payments API Reference](https://payments.magicblock.app/reference)