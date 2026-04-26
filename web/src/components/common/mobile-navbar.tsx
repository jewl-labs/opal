import { motion as m } from 'motion/react';
import { Button } from '../ui/button';

export default function NavbarMobile() {
  return (
    <m.div
      initial={{
        y: -50,
      }}
      animate={{
        y: 0,
      }}
      exit={{
        y: -50,
      }}
      transition={{
        ease: 'anticipate',
      }}
      className="bg-background fixed inset-x-4 -z-10 top-16 flex flex-col gap-3 border-x border-b border-dashed p-4"
    >
      <Button variant="outline">Connect Wallet</Button>
      <a href="/dashboard" className="w-full">
        <Button variant="outline" className="w-full">
          Dashboard
        </Button>
      </a>
      <a href="/statement/feed" className="w-full">
        <Button variant="outline" className="w-full">
          Feed
        </Button>
      </a>
    </m.div>
  );
}
