import { PublicKey } from '@solana/web3.js';

import { getEnv } from '@/lib/env';

export const SEEDS = {
  PROTOCOL_CONFIG: Buffer.from('protocol_config'),
  ASSERTION: Buffer.from('assertion'),
  BOND_VAULT: Buffer.from('bond_vault'),
  LLM_DISPUTE: Buffer.from('llm_dispute'),
  VOTE_DISPUTE: Buffer.from('vote_dispute'),
  LLM_ROUND: Buffer.from('llm_round'),
  VOTE_ROUND: Buffer.from('vote_round'),
} as const;

export function getProgramId(): PublicKey {
  return new PublicKey(getEnv().opalProgramId);
}
