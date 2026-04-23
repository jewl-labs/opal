import Link from 'next/link';
import Container from '../common/container';
import { Button } from '../ui/button';

export default function Navbar() {
    return (
        <Container className="fixed flex h-16 w-full items-center justify-between px-4">
            <Link href="/">
                <h1 className="text-xl font-black tracking-tight uppercase">Opal</h1>
            </Link>
            <Button variant="outline" size="sm">
                Connect Wallet
            </Button>
        </Container>
    );
}
