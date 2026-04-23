import Link from 'next/link';
import Container from '../common/container';
import { Button } from '../ui/button';
import { ModeToggle } from '../common/mode-toggle';

export default function ClaimsNavbar() {
    return (
        <Container className="bg-background fixed z-10 flex h-16 w-full items-center justify-between px-4">
            <Link href="/">
                <h1 className="text-xl font-black tracking-tight uppercase">Opal</h1>
            </Link>
            <div className="flex items-center gap-4">
                <ModeToggle />
                <Link href="/dashboard">
                    <Button variant="outline" size="sm">
                        Dashboard
                    </Button>
                </Link>
                <Button variant="outline" size="sm">
                    Connect Wallet
                </Button>
            </div>
        </Container>
    );
}
