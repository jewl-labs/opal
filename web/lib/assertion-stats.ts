import type { AssertionAccount } from '@/types';

export function computeAssertionStats(assertions: AssertionAccount[]) {
  const totalAssertions = assertions.length;
  const totalDisputes = assertions.reduce((acc, a) => acc + (a.disputeCount || 0), 0);
  const activeAssertions = assertions.filter((a) => {
    const s = (a.state || '').toLowerCase();
    return s.includes('assert') || s.includes('vot') || s.includes('llm');
  }).length;

  const totalBondPUSD = assertions.reduce((acc, a) => acc + (Number(a.bondAmountPUSD) || 0), 0);

  // sum voteResolutionRound.totalValidWeight (may be bigint)
  const totalValidWeight = assertions.reduce((acc, a) => {
    const w = a.voteResolutionRound?.totalValidWeight;
    if (w === undefined || w === null) return acc;
    return acc + Number(w);
  }, 0);

  return {
    totalAssertions,
    totalDisputes,
    activeAssertions,
    totalBondPUSD,
    totalValidWeight,
  };
}

export function topControversialAssertion(assertions: AssertionAccount[]) {
  if (!assertions || assertions.length === 0) return null;
  return (
    assertions.slice().sort((a, b) => (b.disputeCount || 0) - (a.disputeCount || 0))[0] || null
  );
}
