'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { XIcon } from '@phosphor-icons/react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useWallet } from '@/providers/wallet-context';

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function isValidSearchAddress(value: string) {
  if (!value) return false;
  if (/\s/.test(value)) return false;

  const isEthAddress = /^0x[a-fA-F0-9]{40}$/.test(value);
  const isEnsName = /^(?!-)[a-z0-9-]{1,63}(?:\.[a-z0-9-]{2,63})+$/i.test(value);
  const isBase58Address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);

  return isEthAddress || isEnsName || isBase58Address;
}

export function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const router = useRouter();
  const { setCurrentAddress } = useWallet();
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const normalizedAddress = walletAddress.trim();
  const isInputValid = isValidSearchAddress(normalizedAddress);
  const showError = hasAttemptedSubmit && normalizedAddress.length > 0 && !isInputValid;

  useEffect(() => {
    if (!isOpen) return;

    // Store the element that had focus before opening dialog
    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap: keep Tab/Shift+Tab within dialog
      if (e.key === 'Tab') {
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          const focusableElements = dialog.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const focusableArray = Array.from(focusableElements) as HTMLElement[];
          const firstElement = focusableArray[0];
          const lastElement = focusableArray[focusableArray.length - 1];
          const activeElement = document.activeElement;

          if (e.shiftKey) {
            if (activeElement === firstElement) {
              e.preventDefault();
              lastElement?.focus();
            }
          } else {
            if (activeElement === lastElement) {
              e.preventDefault();
              firstElement?.focus();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Restore focus when dialog closes
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    if (!isInputValid) {
      return;
    }

    setCurrentAddress(normalizedAddress);
    router.push(`/u/${encodeURIComponent(normalizedAddress)}`);
    setWalletAddress('');
    setHasAttemptedSubmit(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-background/95 border-border/70 relative w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl shadow-black/20 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/70 to-transparent" />
        <Button
          aria-label="Close"
          variant="ghost"
          onClick={onClose}
          size="icon"
          className="absolute top-3 right-3 rounded-full"
        >
          <XIcon weight="bold"/>
        </Button>

        <div className="border-border/50 bg-muted/20 border-b px-5 py-4 sm:px-6">
          <p className="text-foreground text-xs font-medium uppercase tracking-[0.22em]">
            Search profile
          </p>
          <p className="text-muted-foreground mt-2 text-sm tracking-tighter text-balance leading-6">
            Paste a valid Ethereum address, ENS name, or base58 wallet address to jump to a user
            profile.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5 sm:px-6">
          <label htmlFor="search-input" className="text-sm font-medium">
            Wallet address
          </label>
          <div className="bg-background border-border/70 rounded-md border p-1 shadow-sm">
            <Input
              id="search-input"
              autoFocus
              type="text"
              placeholder="0x..., vitalik.eth, or a base58 address"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              onBlur={() => setHasAttemptedSubmit(true)}
              aria-invalid={showError}
              aria-describedby={showError ? 'search-dialog-error' : 'search-dialog-help'}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {showError ? (
                <p id="search-dialog-error" className="text-destructive text-sm font-medium">
                  Enter a valid wallet address or ENS name.
                </p>
              ) : null}
            </div>
            <Button type="submit" variant="default" disabled={!isInputValid} className="sm:min-w-28 h-10">
              Search
            </Button>
        </form>
      </div>
    </div>
  );
}
