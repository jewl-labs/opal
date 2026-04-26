import Container from '@/components/common/container';
import Navbar from '@/components/common/navbar';
import DashboardNavigation from '@/components/dashboard/dashboard-navigation';
import { Outlet } from 'react-router-dom';

export default function DashboardLayout() {
  return (
    <div className="relative overflow-x-clip">
      <Container className="border-muted-foreground/50 border-x border-dashed">
        <Navbar />
        <Outlet />
        <DashboardNavigation />
      </Container>
    </div>
  );
}
