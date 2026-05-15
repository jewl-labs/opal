'use client';

import { useMemo, useState } from 'react';

import { AnimatePresence, motion as m } from 'motion/react';

import AssertionCard from '@/components/assertion/assertion-card';
import Header from '@/components/assertion/feed-header';
import Container from '@/components/common/container';
import { ASSERTIONS } from '@/data/assertion';
import { useWallet } from '@/providers/wallet-context';
import type { QuickFilter, SortField, StageFilter } from '@/types/filters';

export default function Assertion() {
  const { currentAddress } = useWallet();
  const [sortField, setSortField] = useState<SortField>('newest');
  const [stageFilter, setStageFilter] = useState<StageFilter>('All');
  const [quickFilters, setQuickFilters] = useState<QuickFilter[]>([]);

  const handleToggleQuickFilter = (filter: QuickFilter) => {
    setQuickFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]
    );
  };

  const handleResetFilters = () => {
    setSortField('newest');
    setStageFilter('All');
    setQuickFilters([]);
  };

  const assertions = useMemo(() => {
    const stageGroups: Record<Exclude<StageFilter, 'All'>, string[]> = {
      Optimistic: ['Asserted'],
      AwaitingLLM: ['PendingLLM'],
      LLMResolved: ['AssertedLLM', 'PendingVote'],
      Voting: ['Voting'],
      Finalized: ['Resolved'],
    };

    const matchesQuickFilter = (assertion: (typeof ASSERTIONS)[number], filter: QuickFilter) => {
      if (filter === 'onlyDisputed') {
        return assertion.disputeCount > 0;
      }

      if (filter === 'highStakes') {
        return assertion.disputeCount > 1 || assertion.voteResolutionRound !== null;
      }

      if (filter === 'myAssertions') {
        return assertion.asserter === currentAddress;
      }

      if (filter === 'watching') {
        return (
          assertion.asserter === currentAddress ||
          assertion.llmDispute?.disputer === currentAddress ||
          assertion.voteDispute?.disputer === currentAddress
        );
      }

      return assertion.finalizedAt === null;
    };

    const filtered = ASSERTIONS.filter((assertion) => {
      const matchesStage =
        stageFilter === 'All' || stageGroups[stageFilter].includes(assertion.state);
      const matchesQuickFilters = quickFilters.every((filter) =>
        matchesQuickFilter(assertion, filter)
      );

      return matchesStage && matchesQuickFilters;
    });

    return [...filtered].sort((a, b) => {
      if (sortField === 'highestBond') {
        return b.bondAmountPUSD - a.bondAmountPUSD;
      }

      if (sortField === 'mostDisputed') {
        return b.disputeCount - a.disputeCount;
      }

      if (sortField === 'endingSoon') {
        return new Date(a.livenessDeadline).getTime() - new Date(b.livenessDeadline).getTime();
      }

      if (sortField === 'recentlyResolved') {
        return new Date(b.finalizedAt ?? 0).getTime() - new Date(a.finalizedAt ?? 0).getTime();
      }

      const createdAtDelta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

      return sortField === 'oldest' ? createdAtDelta : createdAtDelta * -1;
    });
  }, [currentAddress, quickFilters, sortField, stageFilter]);

  return (
    <Container className="border-muted-foreground/50 flex min-h-screen flex-col border-x border-dashed">
      <Header
        sortField={sortField}
        onSortFieldChange={setSortField}
        stageFilter={stageFilter}
        onStageFilterChange={setStageFilter}
        quickFilters={quickFilters}
        onToggleQuickFilter={handleToggleQuickFilter}
        onResetFilters={handleResetFilters}
      />
      <div className="flex-1 px-4 pt-24 pb-8">
        {assertions.length === 0 ? (
          <div className="text-muted-foreground flex h-[70vh] flex-col items-center justify-center gap-2 text-center">
            <p className="text-base font-medium tracking-wide uppercase">
              No assertions match these filters.
            </p>
            <p className="text-sm">
              Clear one of the filters or pick a different stage and quick-filter combination.
            </p>
          </div>
        ) : (
          <m.div
            layout
            transition={{ layout: { duration: 0.35, ease: 'easeInOut' } }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <AnimatePresence mode="popLayout">
              {assertions.map((data) => (
                <m.div
                  key={data.id}
                  layout
                  layoutId={`card-wrapper-${data.id}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                >
                  <AssertionCard data={data} />
                </m.div>
              ))}
            </AnimatePresence>
          </m.div>
        )}
      </div>
    </Container>
  );
}
