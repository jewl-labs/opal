# A single trusted LLM resolver handles the first dispute

One off-chain resolver service decides the first dispute. Its verdict is posted by a dedicated `ProtocolConfig.resolver` signer that is separate from the protocol authority, and the verdict can be challenged into the staked vote. Trust-minimized inference (Switchboard feeds, TEE attestation) is post-MVP.

**Why.** The LLM layer does not need to be trustless because the vote backstops it ([ADR-0003](0003-private-staked-voting.md)): a wrong verdict gets challenged. A multi-feed Switchboard council would have cost three live LLM feeds to trust-minimize a layer that is already backstopped. Keeping the resolver key apart from governance means a leaked hot key can only post a challengeable verdict.

**Consequence.** The resolver must be trusted to fetch, prompt and report honestly. Its behaviour is pinned by the service contract in [protocol.md](../protocol.md).
