import ClaimsNavbar from '@/components/claims/claims-navbar';
import Container from '@/components/common/container';
import DashboardSidebar from '@/components/dashboard/sidebar';

export default function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <Container>
            <ClaimsNavbar />
            <DashboardSidebar />
            {children}
        </Container>
    );
}
