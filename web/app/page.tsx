import Container from '@/components/common/container';
import Consumer from '@/components/landing/consumers';
import Cta from '@/components/landing/cta';
import Economics from '@/components/landing/economics';
import Faq from '@/components/landing/faq';
import Footer from '@/components/landing/footer';
import Hero from '@/components/landing/hero';
import InstructionFlow from '@/components/landing/instruction-flow';
import Process from '@/components/landing/process';
import ReadOracle from '@/components/landing/read-oracle';
import ResolutionLayers from '@/components/landing/resolution-layers';

export default function Home() {
  return (
    <Container className="border-muted-foreground/50 border-x border-dashed pt-16">
      <Hero />
      <Process />
      <ResolutionLayers />
      <InstructionFlow />
      <Economics />
      <ReadOracle />
      <Consumer />
      <Faq />
      <Cta />
      <Footer />
    </Container>
  );
}
