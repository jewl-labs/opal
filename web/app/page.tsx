import Container from '@/components/common/container';
import Consumer from '@/components/landing/consumers';
import Footer from '@/components/landing/footer';
import Hero from '@/components/landing/hero';
import Process from '@/components/landing/process';
import ResolutionLayers from '@/components/landing/resolution-layers';

export default function Home() {
  return (
    <Container className="border-muted-foreground/50 border-x border-dashed">
      <Hero />
      <Process />
      <ResolutionLayers />
      <Consumer />
      <Footer />
    </Container>
  );
}
