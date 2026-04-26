import { Menu } from 'lucide-react';
import Container from '../common/container';
import { Button } from '../ui/button';
import { useState } from 'react';
import NavbarMobile from './mobile-navbar';

export default function Navbar() {
  const [isMobileNavbarOpen, setIsMobileNavbarOpen] = useState<boolean>(false);

  return (
    <Container className="bg-background fixed z-20 flex h-16 w-full items-center justify-between px-4">
      <a href="/">
        <h1 className="text-xl font-black tracking-tight uppercase">Opal</h1>
      </a>
      <div className="hidden items-center gap-4 md:flex">
        <a href="/dashboard">
          <Button variant="outline" size="sm">
            Dashboard
          </Button>
        </a>
        <Button variant="outline" size="sm">
          Connect Wallet
        </Button>
      </div>
      <div className="flex md:hidden">
        <Button
          onClick={() => setIsMobileNavbarOpen(!isMobileNavbarOpen)}
          size="icon-lg"
          variant="outline"
        >
          <Menu />
        </Button>
      </div>
      <span className="border-muted-foreground/50 absolute -inset-x-64 bottom-0 h-0.5 border-b border-dashed" />
      {isMobileNavbarOpen && <NavbarMobile />}
    </Container>
  );
}
