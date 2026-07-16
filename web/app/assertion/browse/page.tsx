'use client';

import { useMemo, useState } from 'react';

import { AnimatePresence, motion as m } from 'motion/react';

import AssertionCard from '@/components/assertion/assertion-card';
import Header from '@/components/assertion/feed-header';
import { useAssertions } from '@/lib/assertion-store';
import { useWallet } from '@/providers/wallet-context';
import type { AssertionAccount } from '@/types';
import type { QuickFilter, SortField, StageFilter } from '@/types/filters';

export default function Assertion() {
  const { ready, currentAddress } = useWallet();
  const allAssertions = useAssertions();
  const [sortField, setSortField] = useState<SortField>('newest');
  const [stageFilter, setStageFilter] = useState<StageFilter>('All');
  const [quickFilters, setQuickFilters] = useState<QuickFilter[]>([]);
  const [search, setSearch] = useState('');

  const handleToggleQuickFilter = (filter: QuickFilter) => {
    setQuickFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]
    );
  };

  const handleResetFilters = () => {
    setSortField('newest');
    setStageFilter('All');
    setQuickFilters([]);
    setSearch('');
  };

  const assertions = useMemo(() => {
    const stageGroups: Record<Exclude<StageFilter, 'All'>, string[]> = {
      Optimistic: ['Asserted'],
      AwaitingLLM: ['PendingLLM'],
      LLMResolved: ['AssertedLLM', 'PendingVote'],
      Voting: ['Voting'],
      Finalized: ['Resolved'],
    };

    const matchesQuickFilter = (assertion: AssertionAccount, filter: QuickFilter) => {
      if (filter === 'onlyDisputed') {
        return assertion.disputeCount > 0;
      }

      if (filter === 'highStakes') {
        return assertion.disputeCount > 1 || assertion.voteResolutionRound !== null;
      }

      if (filter === 'myAssertions') {
        if (!ready || !currentAddress) return false;
        return assertion.asserter === currentAddress;
      }

      if (filter === 'watching') {
        if (!ready || !currentAddress) return false;
        return (
          assertion.asserter === currentAddress ||
          assertion.llmDispute?.disputer === currentAddress ||
          assertion.voteDispute?.disputer === currentAddress
        );
      }

      return assertion.finalizedAt === null;
    };

    const query = search.trim().toLowerCase();

    const filtered = allAssertions.filter((assertion) => {
      const matchesStage =
        stageFilter === 'All' || stageGroups[stageFilter].includes(assertion.state);
      const matchesQuickFilters = quickFilters.every((filter) =>
        matchesQuickFilter(assertion, filter)
      );
      const matchesSearch = !query || assertion.statement.toLowerCase().includes(query);

      return matchesStage && matchesQuickFilters && matchesSearch;
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
  }, [allAssertions, currentAddress, quickFilters, ready, search, sortField, stageFilter]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        sortField={sortField}
        onSortFieldChange={setSortField}
        stageFilter={stageFilter}
        onStageFilterChange={setStageFilter}
        quickFilters={quickFilters}
        onToggleQuickFilter={handleToggleQuickFilter}
        onResetFilters={handleResetFilters}
        search={search}
        onSearchChange={setSearch}
      />
      <div className="flex-1 px-4 pt-24 pb-8">
        {assertions.length === 0 ? (
          <div className="text-muted-foreground flex h-[70vh] flex-col items-center justify-center gap-2 text-center">
            <p className="font-mono text-xs tracking-widest uppercase">
              No assertions match these filters
            </p>
            <p className="text-sm leading-relaxed">
              Clear the search or filters, or pick a different stage and quick-filter combination.
            </p>
          </div>
        ) : (
          <m.div
            layout
            transition={{ layout: { duration: 0.35, ease: 'easeInOut' } }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <AnimatePresence mode="popLayout">
              {assertions.map((data, index) => (
                <m.div
                  key={data.id}
                  layout
                  layoutId={`card-wrapper-${data.id}`}
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                  transition={{
                    duration: 0.28,
                    ease: 'easeInOut',
                    delay: Math.min(index * 0.03, 0.24),
                  }}
                >
                  <AssertionCard data={data} />
                </m.div>
              ))}
            </AnimatePresence>
          </m.div>
        )}
      </div>
    </div>
  );
}
