import Container from '@/components/common/container';
import Hero from '@/components/landing/hero';

export default function Landing() {
  return (
    <Container className='border-x border-dashed border-muted-foreground/50'>
      <Hero />
    </Container>
  );
}
