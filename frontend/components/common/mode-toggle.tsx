'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';

export function ModeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
                setTheme(() => (theme === 'dark' ? 'light' : 'dark'));
            }}
        >
            {theme === 'dark' ? (
                <Moon className="fill-foreground stroke-foreground" />
            ) : (
                <Sun className="fill-foreground stroke-foreground" />
            )}
        </Button>
    );
}
