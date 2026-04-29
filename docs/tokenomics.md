# Opal Tokenomics

Opal uses two assets with separate jobs:

- Stablecoin is the collateral asset for assertion bonds, dispute bonds, slashing, rewards, and treasury fees. Field names currently say `pusd` but any USD-pegged token is supported.
- OPAL is the protocol token for voting weight, governance/config control, and voter participation incentives (not yet integrated).

This separation keeps dispute collateral stable while still giving OPAL holders responsibility for final subjective resolution.

## Assets

### Stablecoin

The protocol-configured stablecoin is used for assertion bonds, first dispute bonds, second dispute bonds, slashed collateral, disputer rewards, voter reward payouts, and protocol treasury fees.

> **Note:** Field names throughout the program still say `pusd_*` and `*_pusd`. A future PR will rename these to `usd_*` and `*_usd` to reflect the generic stablecoin design.

### OPAL

OPAL is used for private voting weight, governance over protocol parameters, possible future staking or reputation layers, and voter participation incentives.

During voting escalation, OPAL is intended to be locked and counted with time-weighted influence. Not yet implemented.

## Bond Model

### Assertion Bond

The asserter posts a stablecoin bond when creating an assertion. The bond makes incorrect statements costly and funds rewards when a dispute is correct.

The minimum bond is configured in `ProtocolConfig.assertion_bond_min_pusd`.

### First Dispute Bond

The LLM disputer posts a stablecoin bond to challenge the default optimistic `True` resolution. The bond amount is computed as:

```
llm_dispute_bond = assertion_bond * llm_dispute_bond_ratio_bps / 10_000
```

This creates economic symmetry and prevents free griefing.

### Second Dispute Bond

The vote disputer posts a stablecoin bond to challenge the LLM result and open private OPAL voting. The bond amount is computed as:

```
vote_dispute_bond = assertion_bond * vote_dispute_bond_ratio_bps / 10_000
```

## Dispute Correctness

The first dispute does not need to store a challenged resolution because it always challenges the default `True` answer.

```text
llm_dispute_correct = settlement_resolution != True
```

The second dispute stores the LLM result it challenged:

```text
challenged_llm_resolution
vote_dispute_correct = settlement_resolution != challenged_llm_resolution
```

For the first dispute, settlement uses the LLM outcome if no vote happens, or the final vote outcome if the LLM result is challenged. For the second dispute, settlement always uses the final vote outcome.

## Settlement Defaults

### Undisputed Assertion

If the liveness window expires with no dispute:

- assertion resolves `True`
- asserter bond is returned minus protocol fee
- treasury receives the fee

### First Dispute Settles Correct

If the LLM disputer was correct (`settlement_resolution != True`):

- the LLM disputer wins
- the LLM disputer receives their bond + assertion bond minus protocol fee
- treasury receives the fee

### First Dispute Settles Incorrect

If the LLM disputer was incorrect (`settlement_resolution == True`):

- the asserter wins
- the asserter receives their bond + LLM disputer bond minus protocol fee
- treasury receives the fee

### Vote Dispute Settles Correct

If the vote disputer was correct (`settlement_resolution != challenged_llm_resolution`):

- the vote disputer receives their bond back
- no positive incentive is currently distributed

> **Note:** `vote_disputer_reward_share_bps` exists in `ProtocolConfig` but is not yet implemented. The vote disputer currently only gets their bond returned if correct.

### Vote Dispute Settles Incorrect

If the vote disputer was incorrect:

- the vote disputer bond is slashed (added to winner's payout or treasury)

### Voter Rewards

Voter rewards are not yet implemented. `voter_reward_share_bps` exists in `ProtocolConfig` but no voters are created or rewarded. This will be added when MagicBlock private voting is integrated.

## Fee Shares

The protocol validates that the sum of all reward shares does not exceed 10_000 bps (100%):

```text
llm_disputer_reward_share_bps
+ vote_disputer_reward_share_bps
+ voter_reward_share_bps
+ treasury_share_bps
<= 10_000
```

Currently only `protocol_fee_bps` is applied during settlement. The share-based distribution (`llm_disputer_reward_share_bps`, etc.) is reserved for future tokenomics work.
