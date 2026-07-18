import type { ReactNode } from 'react';

import DashboardNavigation from '@/components/activity/activity-navigation';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="pt-16">
      <DashboardNavigation />
      <div className="min-h-[80vh]">{children}</div>
    </div>
  );
}
