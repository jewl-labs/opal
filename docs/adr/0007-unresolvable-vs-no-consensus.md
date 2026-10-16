# Unresolvable is the asserter's fault; NoConsensus is no one's

`Unresolvable` is an affirmative finding that the statement cannot be decided under its spec. The asserter is wrong and normal slashing applies. `NoConsensus` is vote-only: it results when the quorum fails or no option reaches the supermajority, including a round with no votes. Nobody is slashed, ordinary fees still apply, and no rewards are paid. `NoConsensus` uses outcome code 2 and `Unresolvable` uses 3.

**Why.** If every indeterminate result were no-fault, a voter could never win by choosing `Unresolvable`, so nobody would. If `Unresolvable` won whenever no option reached the threshold, a tiny `Unresolvable` stake could capture the whole opposing pool. Splitting the two lets a real supermajority for `Unresolvable` win, while a failed vote assigns no fault.

**Consequence.** The asserter is wrong whenever the final outcome is not `True`, except for `NoConsensus`. Settlement per outcome is in [protocol.md](../protocol.md).
