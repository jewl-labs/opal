import { ArrowDownIcon, ArrowUpIcon } from '@phosphor-icons/react';
import Container from '../common/container';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

type StateFilter = 'All' | 'Active' | 'Voting' | 'Resolved';
type OutcomeFilter = 'All' | 'True' | 'False' | 'Unresolvable' | 'TooEarly';
type SortField = 'createdAt' | 'bondAmountPUSD' | 'state' | 'outcome';

interface HeaderProps {
  sortField: SortField;
  sortOrder: 'asc' | 'desc';
  onSortFieldChange: (value: SortField) => void;
  onToggleSortOrder: () => void;
  stateFilter: StateFilter;
  outcomeFilter: OutcomeFilter;
  onStateFilterChange: (value: StateFilter) => void;
  onOutcomeFilterChange: (value: OutcomeFilter) => void;
}

const STATE_FILTERS: Array<{ value: StateFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Voting', label: 'Voting' },
  { value: 'Resolved', label: 'Resolved' },
];
const OUTCOME_FILTERS: Array<{ value: OutcomeFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'True', label: 'True' },
  { value: 'False', label: 'False' },
  { value: 'Unresolvable', label: 'Unresolvable' },
  { value: 'TooEarly', label: 'TooEarly' },
];
const SORT_FIELDS: Array<{ value: SortField; label: string }> = [
  { value: 'createdAt', label: 'Created Time' },
  { value: 'bondAmountPUSD', label: 'Bond' },
  { value: 'state', label: 'State' },
  { value: 'outcome', label: 'Outcome' },
];

export default function Header({
  sortField,
  sortOrder,
  onSortFieldChange,
  onToggleSortOrder,
  stateFilter,
  outcomeFilter,
  onStateFilterChange,
  onOutcomeFilterChange,
}: HeaderProps) {
  return (
    <Container className="bg-background border-muted-foreground/50 sticky top-16 w-full justify-center z-10 flex h-16 items-center border-b border-dashed px-4">
      <div className="scrollbar-thin flex w-full items-center gap-3 overflow-x-auto whitespace-nowrap py-1">
        <span className="text-muted-foreground uppercase tracking-wide">
          Sort
        </span>
        <Select
          value={sortField}
          onValueChange={(value) => {
            if (value) {
              onSortFieldChange(value);
            }
          }}
        >
          <SelectTrigger size="sm" className="w-44 capitalize">
            <SelectValue placeholder="Created Time" />
          </SelectTrigger>
          <SelectContent>
            {SORT_FIELDS.map((option) => (
              <SelectItem className="capitalize" key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onToggleSortOrder}
          className="border-muted-foreground/40"
          aria-label={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
        >
          {sortOrder === 'asc' ? <ArrowUpIcon weight="bold" /> : <ArrowDownIcon weight="bold" />}
        </Button>

        <span className="text-muted-foreground ml-2 uppercase tracking-wide">
          State
        </span>
        <Select
          value={stateFilter}
          onValueChange={(value) => {
            if (value) {
              onStateFilterChange(value);
            }
          }}
        >
          <SelectTrigger size="sm" className="w-34 uppercase">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            {STATE_FILTERS.map((option) => (
              <SelectItem className="uppercase" key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-muted-foreground ml-2 uppercase tracking-wide">
          Outcome
        </span>
        <Select
          value={outcomeFilter}
          onValueChange={(value) => {
            if (value) {
              onOutcomeFilterChange(value);
            }
          }}
        >
          <SelectTrigger size="sm" className="w-40 uppercase">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            {OUTCOME_FILTERS.map((option) => (
              <SelectItem className="uppercase" key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Container>
  );
}
