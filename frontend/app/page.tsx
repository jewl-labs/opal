import Container from '@/components/common/container';
import Hero from '@/components/landing/hero';
import Navbar from '@/components/landing/navbar';

export default function Home() {
    return (
        <Container>
            <Navbar />
            <Hero />
        </Container>
    );
}
