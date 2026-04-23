# TypeScript Frontend Setup (Kit + Kite + Codama)

This setup uses `@solana/kit` with a helper library `solana-kite` along with a codama client

## Dependencies

```json
{
  "dependencies": {
    "@solana/kit": "6.1.0",
    "solana-kite": "3.2.0",
    "@magicblock-labs/ephemeral-rollups-kit": "0.8.5"
  }
}
```

## Recommended Client Imports

```typescript
import {
  address,
  createKeyPairSignerFromBytes,
  lamports,
  type Address,
  type TransactionSigner,
} from "@solana/kit";
import { connect, type Connection } from "solana-kite";
import { DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-kit";
```

## Devnet Router Resolution (Endpoint + Validator)

Use the devnet router to select the right MagicBlock endpoint and validator together. Do not hardcode a validator for `devnet-us`, `devnet-as`, or `devnet-eu`.

```typescript
type DevnetRouterResult = {
  identity: string;
  fqdn: string;
};

const normalizeHttpEndpoint = (value: string): string =>
  value.startsWith("http") ? value : `https://${value}`;

const toWsEndpoint = (httpEndpoint: string): string =>
  httpEndpoint.startsWith("https://")
    ? httpEndpoint.replace("https://", "wss://")
    : httpEndpoint.replace("http://", "ws://");

async function resolveDevnetRoute(): Promise<DevnetRouterResult> {
  const response = await fetch("https://devnet-router.magicblock.app/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getIdentity" }),
  });

  const payload = (await response.json()) as {
    result?: { identity?: string; fqdn?: string };
  };

  if (!payload.result?.identity || !payload.result?.fqdn) {
    throw new Error("Router did not return both identity and fqdn");
  }

  return {
    identity: payload.result.identity,
    fqdn: payload.result.fqdn,
  };
}
```

## Dual Connections

```typescript
const baseUrl =
  process.env.BASE_ENDPOINT ||
  (isDevnet ? "https://api.devnet.solana.com" : "http://127.0.0.1:8899");
const baseWsUrl =
  process.env.BASE_WS_ENDPOINT ||
  (isDevnet ? "wss://api.devnet.solana.com" : "ws://127.0.0.1:8900");

let ephemeralUrl = process.env.EPHEMERAL_ENDPOINT || "http://127.0.0.1:7799";
let ephemeralWsUrl = process.env.EPHEMERAL_WS_ENDPOINT || "ws://127.0.0.1:7800";

const baseConnection = connect(baseUrl, baseWsUrl);
const erConnection = connect(ephemeralUrl, ephemeralWsUrl);
```

## Transaction Flow Summary

| Action | Send To | Connection |
|--------|---------|------------|
| Initialize delegated account | Base layer | `baseConnection` |
| Delegate | Base layer | `baseConnection` |
| Mutations on delegated account | Ephemeral rollup | `erConnection` |
| Commit state | Ephemeral rollup | `erConnection` |
| Undelegate | Ephemeral rollup | `erConnection` |

## Check Delegation Status

```typescript
function checkIsDelegated(accountOwner: Address | undefined): boolean {
  return (accountOwner === DELEGATION_PROGRAM_ID);
}

const accountInfo = await baseConnection.rpc.getAccountInfo(pda).send();
const isDelegated = checkIsDelegated(accountInfo.value?.owner);
```

## End-to-End Example (Codama Instructions)

```typescript
const [counterPda] = await findCounterPda();

const initializeIx = getInitializeInstruction({
  payer: authority,
  counter: counterPda,
});

await baseConnection.sendTransactionFromInstructions({
  feePayer: authority,
  instructions: [initializeIx],
  commitment: "confirmed",
});

const [delegationRecordCounter] = await findDelegationRecordCounterPda(
  { counter: counterPda },
  { programAddress: DELEGATION_PROGRAM_ID },
);
const [delegationMetadataCounter] = await findDelegationMetadataCounterPda(
  { counter: counterPda },
  { programAddress: DELEGATION_PROGRAM_ID },
);

const delegateIx = await getDelegateInstructionAsync({
  payer: authority,
  counter: counterPda,
  validator: erValidator,
  delegationProgram: DELEGATION_PROGRAM_ID,
  delegationRecordCounter,
  delegationMetadataCounter,
});

await baseConnection.sendTransactionFromInstructions({
  feePayer: authority,
  instructions: [delegateIx],
  commitment: "confirmed",
});

const incrementIx = getIncrementInstruction({ counter: counterPda });
await erConnection.sendTransactionFromInstructions({
  feePayer: authority,
  instructions: [incrementIx],
  commitment: "confirmed",
});

const commitIx = getCommitInstruction({ payer: authority, counter: counterPda });
await erConnection.sendTransactionFromInstructions({
  feePayer: authority,
  instructions: [commitIx],
  commitment: "confirmed",
});

const undelegateIx = getUndelegateInstruction({
  payer: authority,
  counter: counterPda,
});
await erConnection.sendTransactionFromInstructions({
  feePayer: authority,
  instructions: [undelegateIx],
  commitment: "confirmed",
});
```

## Count Read Helper

```typescript
async function getCurrentCount(connection: Connection, counter: Address): Promise<bigint> {
  const maybe = await fetchMaybeCounter(connection.rpc, counter);
  return maybe.exists ? maybe.data.count : 0n;
}
```

## Environment Variables

```bash
CLUSTER=devnet
BASE_ENDPOINT=https://api.devnet.solana.com
BASE_WS_ENDPOINT=wss://api.devnet.solana.com

# Optional overrides. If omitted on devnet, route + validator are resolved from router.
EPHEMERAL_ENDPOINT=
EPHEMERAL_WS_ENDPOINT=
ER_VALIDATOR=

# Optional signer bytes when running headless.
AUTHORITY_BYTES=[1,2,3,...]
```

## Practical Notes

- Keep Codama as the source of truth for instruction/account builders.
- For delegation, explicitly pass delegation metadata/record PDAs if facing errors.
- Re-read account state from base after commit/undelegate with a short delay to allow propagation.
- Use environment overrides for deterministic CI; use router resolution for developer machines.
