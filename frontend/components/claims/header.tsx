import { SearchIcon } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';
import { Kbd, KbdGroup } from '../ui/kbd';
import Container from '../common/container';
import { Button } from '../ui/button';

interface HeaderProps {
    sortOrder: 'asc' | 'desc';
    onToggleSort: () => void;
}

export default function Header({ sortOrder, onToggleSort }: HeaderProps) {
    return (
        <Container className="bg-background fixed inset-x-0 flex items-center justify-between border-b border-dashed px-4">
            <div>
                <Button variant="outline" onClick={onToggleSort}>
                    Sort by Bond: {sortOrder === 'asc' ? 'Low → High' : 'High → Low'}
                </Button>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-6 py-4">
                <InputGroup>
                    <InputGroupInput placeholder="Search for Claims" />
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
        </Container>
    );
}
