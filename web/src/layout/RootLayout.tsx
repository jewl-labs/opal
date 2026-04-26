import Container from '@/components/common/container';
import Navbar from '@/components/common/navbar';
import { Outlet } from 'react-router-dom';

export default function RootLayout() {
  return (
    <div className="relative overflow-x-clip">
      <Container className="border-muted-foreground/50 border-x border-dashed">
        <Navbar />
      </Container>
      <Outlet />
    </div>
  );
}
