import type { ReactNode } from 'react';

import DashboardNavigation from '@/components/activity/activity-navigation';
import Container from '@/components/common/container';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <Container className="border-muted-foreground/50 border-b-muted/50 border-x border-dashed pt-16">
      <DashboardNavigation />
      <div className="min-h-[80vh]">{children}</div>
    </Container>
  );
}
