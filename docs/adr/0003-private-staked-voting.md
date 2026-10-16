# The final escalation is a private, linear, slashed stake vote

A challenged LLM verdict goes to a per-dispute USDC-staked vote. Weight is linear in stake. Losing stake is slashed and pays the winners. The tally stays hidden while voting is open. A dual quorum (total stake and distinct wallets) and an inclusive supermajority must be met, otherwise the round resolves `NoConsensus`. The intended mechanism is a MagicBlock Private Ephemeral Rollup, gated on a feasibility spike ([vote-stage.md](../vote-stage.md)).

**Why.** No weight curve resists both whales and Sybils: sub-linear weight rewards splitting stake across wallets, while linear weight is Sybil-neutral. Slashing is what makes a wrong vote expensive, so weight stays linear. A visible running tally makes "follow the leader" the safe strategy; hiding it forces voters to coordinate on the spec's honest answer. The quorum stops a dust-sized vote from deciding three bonds. Time-weighted voting was rejected because it rewards a first-moving attacker.

**Consequence.** MagicBlock is the critical-path dependency. If the spike fails, the mechanism changes (for example to commit-reveal); these rules do not.
