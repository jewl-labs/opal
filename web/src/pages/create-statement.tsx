import Container from '@/components/common/container';
import HeroBackground from '@/components/landing/background';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Link2Icon } from 'lucide-react';

export default function CreateStatement() {
  return (
    <Container className="border-muted-foreground/50 relative flex h-screen items-center justify-center border-x border-dashed">
      <div className="bg-muted/25 border-muted border-dashed focus-within:border-primary text-muted-foreground h-34 md:w-150 w-full mx-4 border backdrop-blur-md">
        <Textarea id="statement" placeholder="Enter a statement" />
        <div className="flex h-15 items-center justify-between p-4">
          <Button size="icon-lg" variant="outline">
            <Link2Icon />
          </Button>
          <Button size="lg">Stake to Confirm</Button>
        </div>
      </div>
      <HeroBackground />
    </Container>
  );
}
