'use client';

import { useMemo, useState } from 'react';

import Container from '@/components/common/container';
import Header from '@/components/assertion/feed-header';
import AssertionCard from '@/components/assertion/assertion-card';
import { ASSERTIONS } from '@/data/assertion';
import type { StateFilter, OutcomeFilter, SortField } from '@/types/filters';

export default function Assertion() {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [stateFilter, setStateFilter] = useState<StateFilter>('All');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('All');

  const handleToggleSortOrder = () => {
    setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const assertions = useMemo(() => {
    const stateGroups: Record<Exclude<StateFilter, 'All'>, string[]> = {
      Active: ['Asserted', 'PendingLLM', 'AssertedLLM'],
      Voting: ['PendingVote', 'Voting'],
      Resolved: ['Resolved'],
    };

    const filtered = ASSERTIONS.filter((assertion) => {
      const matchesState =
        stateFilter === 'All' || stateGroups[stateFilter].includes(assertion.state);
      const matchesOutcome =
        outcomeFilter === 'All' || assertion.outcome === outcomeFilter;

      return matchesState && matchesOutcome;
    });

    return [...filtered].sort((a, b) => {
      const compare = (() => {
        if (sortField === 'bondAmountPUSD') {
          return a.bondAmountPUSD - b.bondAmountPUSD;
        }

        if (sortField === 'state') {
          return a.state.localeCompare(b.state);
        }

        if (sortField === 'outcome') {
          return (a.outcome ?? '').localeCompare(b.outcome ?? '');
        }

        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })();

      return sortOrder === 'asc' ? compare : compare * -1;
    });
  }, [outcomeFilter, sortField, sortOrder, stateFilter]);

  return (
    <Container className="border-muted-foreground/50 border-x min-h-screen border-dashed flex flex-col">
      <Header
        sortField={sortField}
        sortOrder={sortOrder}
        onSortFieldChange={setSortField}
        onToggleSortOrder={handleToggleSortOrder}
        stateFilter={stateFilter}
        outcomeFilter={outcomeFilter}
        onStateFilterChange={setStateFilter}
        onOutcomeFilterChange={setOutcomeFilter}
      />
      <div className="flex-1 px-4 pt-24 pb-8">
        {assertions.length === 0 ? (
          <div className="border-muted-foreground/40 bg-muted/10 text-muted-foreground flex h-full flex-col items-center justify-center gap-2 border border-dashed px-6 text-center">
            <p className="text-base font-medium uppercase tracking-wide">
              No assertions match these filters.
            </p>
            <p className="text-sm">
              Clear one of the filters or pick a different state/outcome combination.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {assertions.map((data) => (
              <AssertionCard key={data.id} data={data} />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
