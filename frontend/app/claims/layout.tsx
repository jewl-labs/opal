import ClaimsNavbar from '@/components/claims/claims-navbar';
import Container from '@/components/common/container';

export default function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <Container>
            <ClaimsNavbar />
            {children}
        </Container>
    );
}
