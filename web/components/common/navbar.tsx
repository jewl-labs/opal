'use client';

import { useState } from 'react';

import { Menu, XIcon } from 'lucide-react';

import Container from '../common/container';
import { Button } from '../ui/button';
import NavbarMobile from './mobile-navbar';

export default function Navbar() {
  const [isMobileNavbarOpen, setIsMobileNavbarOpen] = useState<boolean>(false);

  return (
    <div className="bg-background fixed inset-x-0 top-0 z-30 overflow-x-clip">
      <Container className="border-muted-foreground/50 flex h-16 items-center justify-between border-x border-dashed px-4">
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
            {isMobileNavbarOpen ? <XIcon /> : <Menu />}
          </Button>
        </div>
      </Container>
      <span className="border-muted-foreground/50 absolute right-0 bottom-0 left-0 h-0.5 border-b border-dashed" />
      {isMobileNavbarOpen && <NavbarMobile />}
    </div>
  );
}
