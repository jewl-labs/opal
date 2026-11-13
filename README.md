# Opal

A Solana optimistic oracle for natural-language statements.

An asserter posts a statement, a USDC bond and a Resolution Spec, the rubric for how the statement is judged. The statement resolves `True` unless someone disputes it. The first dispute goes to a trusted LLM resolver, and challenging that verdict escalates to a private staked vote. Opal resolves _rubric-relative_ truth: it applies each assertion's spec rather than judging reality.

Target use case: resolving prediction markets on questions no price feed can answer, such as "Kanye West's Delhi concert got postponed".

## Docs

- [Glossary](docs/glossary.md): the vocabulary. Start here.
- [Protocol](docs/protocol.md): every MVP rule and parameter.
- [Architecture](docs/architecture.md): the program as built, and what is left to build.
- [Vote stage](docs/vote-stage.md): the gated private-vote design.
- [Decisions](docs/adr/): why the four most-questioned choices were made.
- [AGENTS.md](AGENTS.md): how to work in this repo.
- [Web frontend](web/README.md): the Next.js app (mock data, no program integration yet).

## Quickstart

Requirements: Solana CLI 3.1+, Anchor 1.1.2, surfpool 1.4+, Bun, Rust 1.89.0.

```bash
bun install
anchor build         # program, target/idl and target/types
anchor test          # TypeScript integration suite on surfpool
cargo test -p opal   # pure Rust unit tests
```

## Security

Not audited. Don't use in production.

## License

Not selected yet.
