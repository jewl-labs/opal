import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                'placeholder:text-muted-foreground flex field-sizing-content no-scrollbar h-17 w-full resize-none bg-transparent p-4 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-md',
                className
            )}
            {...props}
        />
    );
}

export { Textarea };
