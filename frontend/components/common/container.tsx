import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ContainerProps {
    children: ReactNode;
    className?: string;
}

export default function Container({ children, className }: ContainerProps) {
    return (
        <div className={cn(className, 'mx-auto max-w-6xl border-x border-dashed')}>{children}</div>
    );
}
