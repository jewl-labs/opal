'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { XIcon } from '@phosphor-icons/react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useWallet } from '@/providers/wallet-context';

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const router = useRouter();
  const { setCurrentAddress } = useWallet();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (walletAddress.trim()) {
      const trimmedAddress = walletAddress.trim();
      setCurrentAddress(trimmedAddress);
      router.push(`/u/${trimmedAddress}`);
      setWalletAddress('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background border-muted-foreground/10 relative w-full max-w-lg border shadow-xl sm:max-w-xl md:max-w-2xl p-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
      >
        <Button
          aria-label="Close"
          variant="ghost"
          onClick={onClose}
          size="icon"
          className="absolute top-3 right-3"
        >
          <XIcon />
        </Button>

        <h2
          id="search-dialog-title"
          className="mb-4 text-xl font-semibold tracking-tight sm:text-2xl"
        >
          Search user
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label htmlFor="search-input" className="sr-only">
            Wallet address
          </label>
          <Input
            id="search-input"
            autoFocus
            type="text"
            placeholder="Paste wallet address or ENS..."
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="w-full"
          />

          <div className="flex gap-2 items-center justify-between">
            <div className="text-muted-foreground text-sm">
              Press <kbd className="bg-muted rounded px-2 py-1 text-sm font-semibold">Enter</kbd>
            </div>
            <Button type="submit" variant="default">
              Search
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
