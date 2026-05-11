'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { XIcon } from '@phosphor-icons/react';

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
  const inputRef = useRef<HTMLInputElement | null>(null);

  const normalized = walletAddress.trim();
  const isInputValid = isValidSearchAddress(normalized);
  const showError = attempted && normalized.length > 0 && !isInputValid;

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!isInputValid) return;
    router.push(`/u/${encodeURIComponent(normalized)}`);
    setWalletAddress('');
    setAttempted(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative mx-4 w-full max-w-[440px]',
          'bg-background border-border border',
          'shadow-2xl shadow-black/40',
          'animate-in fade-in-0 zoom-in-95 duration-150'
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
      >
        {/* Top bar */}
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-muted-foreground/30 size-1.5 rounded-full" />
            <span
              id="search-dialog-title"
              className="text-muted-foreground font-mono text-[11px] font-medium tracking-[0.12em] uppercase"
            >
              search profiles
            </span>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-5">
          <form onSubmit={handleSubmit}>
            {/* Input */}
            <div
              className={cn(
                'flex items-center gap-2 border px-3 py-2.5 transition-colors',
                showError
                  ? 'border-destructive/60 bg-destructive/5'
                  : 'border-border bg-muted/30 focus-within:border-foreground/30 focus-within:bg-transparent'
              )}
            >
              <span className="text-muted-foreground/50 shrink-0 font-mono text-[11px] font-medium select-none">
                /u/
              </span>
              <input
                ref={inputRef}
                id="search-input"
                type="text"
                placeholder="0x… · name.eth · base58"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                aria-invalid={showError}
                aria-describedby={showError ? 'search-dialog-error' : undefined}
                className={cn(
                  'placeholder:text-muted-foreground/30 w-full bg-transparent font-mono text-sm outline-none',
                  showError ? 'text-destructive' : 'text-foreground'
                )}
              />
            </div>

            {/* Accepted formats row */}
            <div className="mt-2.5 flex items-center gap-1.5">
              {ADDRESS_FORMATS.map((fmt) => (
                <span
                  key={fmt.label}
                  className="border-border/60 inline-flex items-center gap-1 border px-1.5 py-0.5"
                >
                  <span className="text-muted-foreground/60 font-mono text-[9px] font-semibold tracking-wider uppercase">
                    {fmt.label}
                  </span>
                  <span className="text-muted-foreground/35 font-mono text-[9px]">{fmt.hint}</span>
                </span>
              ))}
              {showError && (
                <p
                  id="search-dialog-error"
                  className="text-destructive ml-auto font-mono text-[10px]"
                >
                  invalid address
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between">
              <span className="text-muted-foreground/30 font-mono text-[10px] select-none">
                ↵ to search
              </span>
              <button
                type="submit"
                disabled={!isInputValid}
                className={cn(
                  'font-mono text-[11px] tracking-[0.1em] uppercase transition-all',
                  'border px-4 py-1.5',
                  isInputValid
                    ? 'border-foreground/20 bg-foreground text-background hover:bg-foreground/90'
                    : 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                )}
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
