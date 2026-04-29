'use client';

import { useState } from 'react';

import { motion as m } from 'motion/react';

import EvidenceSection from '@/components/assert/EvidenceSection';
import ParamsSection from '@/components/assert/ParamsSection';
import SectionHeader from '@/components/assert/SectionHeader';
import StatementSection from '@/components/assert/StatementSection';
import SummarySection from '@/components/assert/SummarySection';
import Container from '@/components/common/container';

const MIN_BOND = 10;
const MAX_CHARS = 280;

const WINDOWS = [
  { label: '24h', value: 86400 },
  { label: '3 days', value: 259200 },
  { label: '7 days', value: 604800 },
  { label: '30 days', value: 2592000 },
];

type Section = 'statement' | 'params' | 'evidence' | 'summary';

function formatExpiry(seconds: number) {
  const d = new Date(Date.now() + seconds * 1000);
  return d.toUTCString().replace('GMT', 'UTC').slice(0, -4);
}

function hashPreview(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0') + '...';
}

export default function CreateStatement() {
  const [open, setOpen] = useState<Section>('statement');
  const [statement, setStatement] = useState('');
  const [bond, setBond] = useState(50);
  const [window_, setWindow] = useState(WINDOWS[2]);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [walletConnected] = useState(false);

  const toggle = (s: Section) => setOpen((prev) => (prev === s ? 'statement' : s));

  const statementWarning =
    statement.length > 0 && statement.length < 10
      ? 'Too short to be resolvable'
      : statement.endsWith('?')
        ? 'Use a declarative statement, not a question'
        : null;

  const bondWarning = bond < MIN_BOND && bond > 0 ? `Minimum bond is ${MIN_BOND} PUSD` : null;

  const isValid =
    statement.length >= 10 && !statement.endsWith('?') && bond >= MIN_BOND && walletConnected;

  const buttonLabel = !walletConnected
    ? 'Connect Wallet to Assert'
    : !isValid
      ? 'Stake to Confirm'
      : `Stake ${bond} PUSD and Assert`;

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
            onClick={() => toggle('params')}
            peek={`${bond} PUSD · ${window_ && window_.label ? window_.label : (WINDOWS[0]?.label ?? '24h')}`}
          />
          <ParamsSection
            open={open === 'params'}
            bond={bond}
            setBond={setBond}
            bondWarning={bondWarning}
            minBond={MIN_BOND}
            window_={window_ ?? WINDOWS[0] ?? { label: '24h', value: 86400 }}
            setWindow={setWindow}
            windows={WINDOWS}
            formatExpiry={formatExpiry}
          />

          <SectionHeader
            label="Evidence Link"
            open={open === 'evidence'}
            onClick={() => toggle('evidence')}
            peek={
              evidenceUrl ? (
                <span className="text-primary/60">{evidenceUrl}</span>
              ) : statement.length > 20 ? (
                <span className="text-amber-400/60">⚠ none attached</span>
              ) : undefined
            }
          />
          <EvidenceSection
            open={open === 'evidence'}
            evidenceUrl={evidenceUrl}
            setEvidenceUrl={setEvidenceUrl}
            statementLength={statement.length}
          />

          <SectionHeader
            label="Claim Summary"
            open={open === 'summary'}
            onClick={() => toggle('summary')}
            peek={statement ? `${statement.slice(0, 40)}…` : undefined}
          />
          <SummarySection
            open={open === 'summary'}
            statement={statement}
            bond={bond}
            windowLabel={window_ && window_.label ? window_.label : (WINDOWS[0]?.label ?? '24h')}
            windowValue={
              window_ && typeof window_.value === 'number'
                ? window_.value
                : (WINDOWS[0]?.value ?? 86400)
            }
            evidenceUrl={evidenceUrl}
            hashPreview={hashPreview}
            formatExpiry={formatExpiry}
          />

          <div className="border-muted-foreground/20 mt-auto border-t border-dashed p-5">
            <m.button
              whileHover={isValid ? { scale: 1.005 } : {}}
              whileTap={isValid ? { scale: 0.995 } : {}}
              disabled={!isValid}
              className={`w-full py-4 text-sm tracking-widest uppercase transition-colors ${
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
