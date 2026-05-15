import type { QuickFilter, SortField, StageFilter } from '@/types/filters';

import Container from '../common/container';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface HeaderProps {
  sortField: SortField;
  onSortFieldChange: (value: SortField) => void;
  stageFilter: StageFilter;
  onStageFilterChange: (value: StageFilter) => void;
  quickFilters: QuickFilter[];
  onToggleQuickFilter: (value: QuickFilter) => void;
  onResetFilters: () => void;
}

const SORT_FIELDS: Array<{ value: SortField; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'endingSoon', label: 'Ending soon' },
  { value: 'highestBond', label: 'Highest bond' },
  { value: 'mostDisputed', label: 'Most disputed' },
  { value: 'recentlyResolved', label: 'Recently resolved' },
];

const STAGE_FILTERS: Array<{ value: StageFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Optimistic', label: 'Optimistic' },
  { value: 'AwaitingLLM', label: 'Awaiting LLM' },
  { value: 'LLMResolved', label: 'LLM Resolved' },
  { value: 'Voting', label: 'Voting' },
  { value: 'Finalized', label: 'Finalized' },
];

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
  { value: 'onlyDisputed', label: 'Only Disputed' },
  { value: 'highStakes', label: 'High Stakes' },
  { value: 'myAssertions', label: 'My Assertions' },
  { value: 'watching', label: 'Watching' },
  { value: 'unresolved', label: 'Unresolved' },
];

export default function Header({
  sortField,
  onSortFieldChange,
  stageFilter,
  onStageFilterChange,
  quickFilters,
  onToggleQuickFilter,
  onResetFilters,
}: HeaderProps) {
  return (
    <Container className="bg-background border-muted-foreground/50 sticky top-16 z-10 flex h-16 w-full items-center justify-center border-b border-dashed">
      <div className="flex w-full scrollbar-thin items-center gap-2 overflow-x-auto px-4 py-1 whitespace-nowrap">
        <span
          id="feed-sort-label"
          className="text-muted-foreground text-[11px] tracking-[0.24em] uppercase"
        >
          Sort by
        </span>
        <Select
          value={sortField}
          onValueChange={(value) => {
            if (value) {
              onSortFieldChange(value);
            }
          }}
        >
          <SelectTrigger aria-labelledby="feed-sort-label" size="sm">
            <SelectValue>
              {SORT_FIELDS.find((o) => o.value === sortField)?.label ?? 'Newest'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_FIELDS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span
          id="feed-stage-label"
          className="text-muted-foreground ml-2 text-[11px] tracking-[0.24em] uppercase"
        >
          Stage
        </span>
        <Select
          value={stageFilter}
          onValueChange={(value) => {
            if (value) {
              onStageFilterChange(value);
            }
          }}
        >
          <SelectTrigger aria-labelledby="feed-stage-label" size="sm">
            <SelectValue>
              {STAGE_FILTERS.find((o) => o.value === stageFilter)?.label ?? 'All'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STAGE_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 pl-1">
          {QUICK_FILTERS.map((filter) => {
            const isActive = quickFilters.includes(filter.value);

            return (
              <Button
                key={filter.value}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                aria-pressed={isActive}
                onClick={() => onToggleQuickFilter(filter.value)}
                className="border-muted-foreground/40 px-2.5"
              >
                {filter.label}
              </Button>
            );
          })}

          <Button
            type="button"
            variant="ghost"
            onClick={onResetFilters}
            className="text-muted-foreground/70 hover:text-muted-foreground ml-1 px-2"
          >
            Reset
          </Button>
        </div>
      </div>
    </Container>
  );
}
