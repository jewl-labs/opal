import Container from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Link2Icon } from 'lucide-react';

export default function CreateClaim() {
    return (
        <Container className="flex h-screen items-center justify-center">
            <div className="bg-muted text-muted-foreground h-34 w-150 rounded-xl">
                <Textarea id="statement" placeholder="Enter a statement" />
                <div className="flex h-15 items-center justify-between p-4">
                    <Button size="icon-lg" variant="outline">
                        <Link2Icon />
                    </Button>
                    <Button size="lg">Stake to Confirm</Button>
                </div>
            </div>
        </Container>
    );
}
