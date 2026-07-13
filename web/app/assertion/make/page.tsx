'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { motion as m } from 'motion/react';

import EvidenceSection from '@/components/assertion/evidence-section';
import ParamsSection from '@/components/assertion/params-section';
import SectionHeader from '@/components/assertion/section-header';
import StatementSection from '@/components/assertion/statement-section';
import SummarySection from '@/components/assertion/summary-section';
import { ASSERTION_BOND_PUSD } from '@/data/assertion';
import { addAssertion } from '@/lib/assertion-store';
import { useWallet } from '@/providers/wallet-context';

const MAX_CHARS = 280;

// Bond and dispute window are fixed protocol parameters (mock).
const DISPUTE_WINDOW = { label: '7 days', seconds: 604800 };

type Section = 'statement' | 'params' | 'evidence' | 'summary';

function formatExpiry(baseTime: number, seconds: number) {
  const d = new Date(baseTime + seconds * 1000);
  // Keep the ' UTC' marker: the Params/Summary sections reparse this string, and
  // dropping the zone made `new Date(...)` read it as local time (off by the viewer's
  // offset). With the marker it parses back to the correct instant everywhere.
  return d.toUTCString().replace('GMT', 'UTC');
}

function hashPreview(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0') + '...';
}

// Toy 32-hex-char content hash — stands in for the real SHA-256 auxiliary hash.
function mockHash(str: string) {
  let h = 2166136261;
  let out = '';
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619 + round);
    out += (h >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// Mock assertion id — stands in for the caller-supplied `assertion_id` PDA seed.
function generateMockId() {
  let id = '';
  for (let i = 0; i < 32; i++) id += BASE58.charAt(Math.floor(Math.random() * BASE58.length));
  return id;
}

const SECTION_ORDER: Section[] = ['statement', 'params', 'evidence', 'summary'];

export default function MakeAssertion() {
  const router = useRouter();
  const { ready, authenticated, currentAddress, login } = useWallet();

  const [open, setOpen] = useState<Section>('statement');
  const [statement, setStatement] = useState('');
  const bond = ASSERTION_BOND_PUSD;
  const [auxiliaryData, setAuxiliaryData] = useState('');

  // Live clock so the expiry preview tracks real time. The stored deadline is computed
  // from Date.now() at submit, so what the user sees is accurate to within the tick.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const toggle = (s: Section) => setOpen((prev) => (prev === s ? 'statement' : s));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        setOpen((prev) => {
          const idx = SECTION_ORDER.indexOf(prev);
          const prevIdx = idx - 1;
          return prevIdx >= 0 ? SECTION_ORDER[prevIdx]! : prev;
        });
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        setOpen((prev) => {
          const idx = SECTION_ORDER.indexOf(prev);
          const nextIdx = idx + 1;
          return nextIdx < SECTION_ORDER.length ? SECTION_ORDER[nextIdx]! : prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Validate against the trimmed statement — the same value handleSubmit stores — so
  // whitespace-only or padded input can't enable the Assert button and persist empty.
  const trimmedStatement = statement.trim();
  const statementWarning =
    trimmedStatement.length > 0 && trimmedStatement.length < 10
      ? 'Too short to be resolvable'
      : trimmedStatement.endsWith('?')
        ? 'Use a declarative statement, not a question'
        : null;

  const statementValid = trimmedStatement.length >= 10 && !trimmedStatement.endsWith('?');
  const walletConnected = ready && authenticated && currentAddress;
  const canSubmit = statementValid && walletConnected;
  const buttonDisabled = Boolean(walletConnected) && !statementValid;

  // Mock create — mirrors `create_assertion`, persisted in the client-side store
  // until the on-chain transaction is wired.
  const handleSubmit = () => {
    if (!canSubmit || !currentAddress) return;

    const id = generateMockId();
    const submittedAt = Date.now();

    addAssertion({
      id,
      asserter: currentAddress,
      statement: statement.trim(),
      auxiliaryHash: mockHash(statement + auxiliaryData),
      bondAmountPUSD: bond,
      state: 'Asserted',
      livenessDeadline: new Date(submittedAt + DISPUTE_WINDOW.seconds * 1000).toISOString(),
      outcome: null,
      finalizedAt: null,
      disputeCount: 0,
      llmDispute: null,
      voteDispute: null,
      llmResolutionRound: null,
      voteResolutionRound: null,
      createdAt: new Date(submittedAt).toISOString(),
    });

    router.push(`/assertion/browse/${id}`);
  };

  // From any section but the summary, the primary button advances to the Claim Summary
  // (a deliberate review step) instead of submitting — so a misclick can't stake blind.
  const onPrimary = () => {
    if (!walletConnected) {
      login();
      return;
    }
    if (open !== 'summary') {
      setOpen('summary');
      return;
    }
    handleSubmit();
  };

  const buttonLabel = !walletConnected
    ? 'Sign in to Assert'
    : !statementValid
      ? 'Stake to Confirm'
      : open !== 'summary'
        ? 'Review Claim Summary'
        : `Stake ${bond} USDC and Assert`;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden px-4 pt-18 pb-4">
      <m.div
        initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mt-4 flex h-full flex-col overflow-hidden"
      >
        <div className="bg-background border-border flex h-full flex-col overflow-hidden border">
          <SectionHeader
            label="Statement"
            complete={statementValid}
            open={open === 'statement'}
            onClick={() => toggle('statement')}
            peek={statement || undefined}
            showShortcut={open === 'statement'}
            shortcutHint="Ctrl+Enter"
          />
          <StatementSection
            open={open === 'statement'}
            value={statement}
            setValue={setStatement}
            warning={statementWarning}
            maxChars={MAX_CHARS}
          />

          <SectionHeader
            label="Bond & Window"
            complete
            open={open === 'params'}
            showShortcut={open === 'params'}
            shortcutHint="Ctrl+Enter"
            onClick={() => toggle('params')}
            peek={`${bond} USDC · ${DISPUTE_WINDOW.label}`}
          />
          <ParamsSection
            open={open === 'params'}
            bond={bond}
            windowLabel={DISPUTE_WINDOW.label}
            windowSeconds={DISPUTE_WINDOW.seconds}
            formatExpiry={(seconds) => formatExpiry(now, seconds)}
          />

          <SectionHeader
            label="Resolution Spec"
            complete={Boolean(auxiliaryData)}
            open={open === 'evidence'}
            onClick={() => toggle('evidence')}
            peek={
              auxiliaryData ? (
                <span className="text-primary/60">
                  {auxiliaryData.length > 42 ? auxiliaryData.slice(0, 42) + '...' : auxiliaryData}
                </span>
              ) : statement.length > 20 ? (
                <span className="text-amber-400/60">⚠ none attached</span>
              ) : undefined
            }
            showShortcut={open === 'evidence'}
            shortcutHint="Ctrl+Enter"
          />
          <EvidenceSection
            open={open === 'evidence'}
            auxiliaryData={auxiliaryData}
            setAuxiliaryData={setAuxiliaryData}
            statementLength={statement.length}
          />

          <SectionHeader
            label="Claim Summary"
            complete={statementValid}
            open={open === 'summary'}
            onClick={() => toggle('summary')}
            peek={statement ? `${statement.slice(0, 40)}…` : undefined}
            showShortcut={open === 'summary'}
            shortcutHint="Ready to submit?"
          />
          <SummarySection
            open={open === 'summary'}
            statement={statement}
            bond={bond}
            windowLabel={DISPUTE_WINDOW.label}
            windowValue={DISPUTE_WINDOW.seconds}
            auxiliaryData={auxiliaryData}
            hashPreview={hashPreview}
            formatExpiry={(seconds) => formatExpiry(now, seconds)}
          />

          <div className="border-border mt-auto border-t p-5">
            <m.button
              whileHover={buttonDisabled ? {} : { scale: 1.005 }}
              whileTap={buttonDisabled ? {} : { scale: 0.995 }}
              disabled={buttonDisabled}
              onClick={onPrimary}
              className={`w-full py-4 font-mono text-sm tracking-[0.2em] uppercase transition-colors ${
                buttonDisabled
                  ? 'border-border bg-muted/40 text-muted-foreground cursor-not-allowed border'
                  : 'bg-primary hover:bg-primary/90 cursor-pointer text-black'
              }`}
            >
              {buttonLabel}
            </m.button>
          </div>
        </div>
      </m.div>
    </div>
  );
}
