'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { MagnifyingGlassIcon } from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import Modal from '@/components/ui/modal';
import { cn } from '@/lib/utils';

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

const ADDRESS_FORMATS = [
  { label: 'ETH', hint: '0x…' },
  { label: 'ENS', hint: '*.eth' },
  { label: 'SOL', hint: 'base58' },
];

export function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const [attempted, setAttempted] = useState(false);
  const router = useRouter();

  const normalized = walletAddress.trim();
  const isInputValid = isValidSearchAddress(normalized);
  const showError = attempted && normalized.length > 0 && !isInputValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!isInputValid) return;
    router.push(`/u/${encodeURIComponent(normalized)}`);
    setWalletAddress('');
    setAttempted(false);
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Find Account" align="top">
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            'flex h-16 items-center gap-3 border-b px-5 transition-colors',
            showError ? 'border-destructive/50' : 'border-border'
          )}
        >
          <MagnifyingGlassIcon
            className={cn(
              'size-5 shrink-0',
              showError ? 'text-destructive/70' : 'text-muted-foreground/50'
            )}
          />

          <span className="text-muted-foreground/40 shrink-0 font-mono text-sm select-none">
            /u/
          </span>

          <input
            id="search-input"
            type="text"
            autoFocus
            placeholder="0x… · name.eth · base58"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            aria-invalid={showError}
            aria-describedby={showError ? 'search-dialog-error' : undefined}
            className={cn(
              'placeholder:text-muted-foreground/30 w-full bg-transparent font-mono text-base outline-none md:text-lg',
              showError ? 'text-destructive' : 'text-foreground'
            )}
          />

          {showError && (
            <p
              id="search-dialog-error"
              className="text-destructive shrink-0 font-mono text-[10px] tracking-widest uppercase"
            >
              invalid address
            </p>
          )}
        </div>

        <div className="border-border flex items-center gap-2 border-b px-5 py-3.5">
          <span className="text-muted-foreground/40 mr-1 font-mono text-[10px] tracking-[0.2em] uppercase">
            Formats
          </span>

          {ADDRESS_FORMATS.map((fmt) => (
            <span
              key={fmt.label}
              className="border-border inline-flex items-center gap-1.5 border px-2 py-1"
            >
              <span className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
                {fmt.label}
              </span>
              <span className="text-muted-foreground/50 font-mono text-[10px]">{fmt.hint}</span>
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-muted-foreground/40 flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase select-none">
            <Kbd>↵</Kbd> Find
          </span>

          <Button type="submit" disabled={!isInputValid} className="uppercase">
            Find Account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
