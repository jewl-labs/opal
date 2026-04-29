import { SearchIcon } from 'lucide-react';

import Container from '../common/container';
import { Button } from '../ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';
import { Kbd, KbdGroup } from '../ui/kbd';

interface HeaderProps {
  sortOrder: 'asc' | 'desc';
  onToggleSort: () => void;
}

export default function Header({ sortOrder, onToggleSort }: HeaderProps) {
  return (
    <Container className="bg-background border-muted-foreground/50 sticky top-16 z-0 flex h-16 items-center justify-between border-b border-dashed px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleSort}
          className="hidden sm:inline-flex"
        >
          Sort: {sortOrder === 'asc' ? 'Low → High' : 'High → Low'}
        </Button>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-lg">
          <InputGroup>
            <InputGroupInput placeholder="Search" />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <span>+</span>
                <Kbd>K</Kbd>
              </KbdGroup>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <Button variant="outline" size="sm" onClick={onToggleSort}>
          Sort
        </Button>
      </div>
    </Container>
  );
}
