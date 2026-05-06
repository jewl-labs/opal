'use client';

import { useEffect, useState } from 'react';

import { motion as m } from 'motion/react';

import EvidenceSection from '@/components/assertion/evidence-section';
import ParamsSection from '@/components/assertion/params-section';
import SectionHeader from '@/components/assertion/section-header';
import StatementSection from '@/components/assertion/statement-section';
import SummarySection from '@/components/assertion/summary-section';
import Container from '@/components/common/container';
import { ASSERTION_BOND_PUSD } from '@/data/assertion';

const MAX_CHARS = 280;

const WINDOWS = [
  { label: '24h', value: 86400 },
  { label: '3 days', value: 259200 },
  { label: '7 days', value: 604800 },
  { label: '30 days', value: 2592000 },
];

type Section = 'statement' | 'params' | 'evidence' | 'summary';

function formatExpiry(baseTime: number, seconds: number) {
  const d = new Date(baseTime + seconds * 1000);
  return d.toUTCString().replace('GMT', 'UTC').slice(0, -4);
}

function hashPreview(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0') + '...';
}

export default function MakeAssertion() {
  const [open, setOpen] = useState<Section>('statement');
  const [statement, setStatement] = useState('');
  const bond = ASSERTION_BOND_PUSD;
  const [createdAt] = useState(() => Date.now());
  const [window_, setWindow] = useState<(typeof WINDOWS)[number]>(WINDOWS[2]!);
  const [auxiliaryData, setAuxiliaryData] = useState('');
  const [walletConnected] = useState(false);

  const toggle = (s: Section) => setOpen((prev) => (prev === s ? 'statement' : s));

  const sectionOrder: Section[] = ['statement', 'params', 'evidence', 'summary'];
  const currentIndex = sectionOrder.indexOf(open);

  const nextSection = () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < sectionOrder.length) {
      const next = sectionOrder[nextIdx];
      if (next) setOpen(next);
    }
  };

  const prevSection = () => {
    const prevIdx = currentIndex - 1;
    if (prevIdx >= 0) {
      const prev = sectionOrder[prevIdx];
      if (prev) setOpen(prev);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        prevSection();
      }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        nextSection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const statementWarning =
    statement.length > 0 && statement.length < 10
      ? 'Too short to be resolvable'
      : statement.endsWith('?')
        ? 'Use a declarative statement, not a question'
        : null;

  // Note: bond === ASSERTION_BOND_PUSD check is redundant but kept for defensive validation
  // and potential future refactors where bond might be user-configurable
  const isValid =
    statement.length >= 10 && !statement.endsWith('?') && bond === ASSERTION_BOND_PUSD && walletConnected;

  const buttonLabel = !walletConnected
    ? 'Connect Wallet to Assert'
    : !isValid
      ? 'Stake to Confirm'
      : `Stake ${ASSERTION_BOND_PUSD} PUSD and Assert`;

  return (
    <Container className="border-muted-foreground/50 relative flex h-screen flex-col overflow-hidden border-x border-dashed px-4 pt-18 pb-4">
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 mt-4 flex h-full flex-col overflow-hidden"
      >
        <div className="bg-background border-muted-foreground/50 flex h-full flex-col overflow-hidden border border-dashed">
          <SectionHeader
            label="Statement"
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
            open={open === 'params'}
            showShortcut={open === 'params'}
            shortcutHint="Ctrl+Enter"
            onClick={() => toggle('params')}
            peek={`${ASSERTION_BOND_PUSD} PUSD · ${window_.label}`}
          />
          <ParamsSection
            open={open === 'params'}
            bond={bond}
            window_={window_}
            setWindow={setWindow}
            windows={WINDOWS}
            formatExpiry={(seconds) => formatExpiry(createdAt, seconds)}
          />

          <SectionHeader
            label="Auxiliary Data"
            open={open === 'evidence'}
            onClick={() => toggle('evidence')}
            peek={
              auxiliaryData ? (
                <span className="text-primary/60">{auxiliaryData.slice(0, 42)}...</span>
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
            windowLabel={window_.label}
            windowValue={window_.value}
            auxiliaryData={auxiliaryData}
            hashPreview={hashPreview}
            formatExpiry={(seconds) => formatExpiry(createdAt, seconds)}
          />

          <div className="border-muted-foreground/50 mt-auto border-t border-dashed p-5">
            <m.button
              whileHover={isValid ? { scale: 1.005 } : {}}
              whileTap={isValid ? { scale: 0.995 } : {}}
              disabled={!isValid}
              className={`w-full py-3 text-xs tracking-widest uppercase transition-colors ${
                isValid
                  ? 'bg-primary hover:bg-primary/90 cursor-pointer text-black'
                  : 'bg-muted/30 text-muted-foreground/25 border-muted-foreground/10 cursor-not-allowed border border-dashed'
              }`}
            >
              {buttonLabel}
            </m.button>
          </div>
        </div>
      </m.div>
    </Container>
  );
}
