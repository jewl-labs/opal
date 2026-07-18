'use client';

import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AnimatePresence, motion as m } from 'motion/react';

import SectionHeader from '@/components/assertion/section-header';
import Warning from '@/components/assertion/warning';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getOutcomeLabel } from '@/lib/assertion-labels';
import { fileLlmDispute, fileVoteDispute, useAssertions } from '@/lib/assertion-store';
import { getTimeRemaining, isDeadlinePast } from '@/lib/helpers';
import { useWallet } from '@/providers/wallet-context';

const MIN_REASON_CHARS = 10;
const MAX_REASON_CHARS = 500;

type Section = 'claim' | 'reason' | 'summary';

const SECTION_ORDER: Section[] = ['reason', 'claim', 'summary'];

export default function DisputeAssertion() {
  const router = useRouter();
  const { id } = useParams();
  const idStr = Array.isArray(id) ? id[0] : id;
  const assertions = useAssertions();
  const assertion = assertions.find((s) => s.id === idStr);

  if (!assertion || !idStr) {
    notFound();
  }

  const { ready, authenticated, currentAddress, login } = useWallet();
  const walletConnected = Boolean(ready && authenticated && currentAddress);

  const [open, setOpen] = useState<Section>('reason');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        setOpen((prev) => {
          const idx = SECTION_ORDER.indexOf(prev);
          return idx > 0 ? SECTION_ORDER[idx - 1]! : prev;
        });
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        setOpen((prev) => {
          const idx = SECTION_ORDER.indexOf(prev);
          return idx < SECTION_ORDER.length - 1 ? SECTION_ORDER[idx + 1]! : prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // The same screen serves both dispute layers, keyed by state:
  // Asserted → first dispute (challenges the default TRUE);
  // AssertedLLM → second dispute (challenges the proposed LLM outcome).
  const mode =
    assertion.state === 'Asserted'
      ? ('dispute' as const)
      : assertion.state === 'AssertedLLM'
        ? ('challenge' as const)
        : null;

  const deadline =
    mode === 'dispute'
      ? assertion.livenessDeadline
      : (assertion.llmResolutionRound?.challengeDeadline ?? undefined);

  const windowOpen = mode !== null && !isDeadlinePast(deadline);

  if (!windowOpen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-xl uppercase md:text-2xl">Dispute Unavailable</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {mode === null
            ? 'This assertion’s current state does not accept disputes or challenges.'
            : 'The dispute window has expired.'}
        </p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/assertion/browse/${idStr}`} />}
        >
          Back to Assertion
        </Button>
      </div>
    );
  }

  const challengedOutcome =
    mode === 'dispute'
      ? 'True (Optimistic Default)'
      : `${getOutcomeLabel(assertion.llmResolutionRound?.outcome ?? null)} (LLM Proposed)`;

  const bond = assertion.bondAmountPUSD;

  const reasonWarning =
    reason.length > 0 && reason.trim().length < MIN_REASON_CHARS
      ? 'Too short — explain why the current outcome is wrong'
      : null;

  const reasonValid = reason.trim().length >= MIN_REASON_CHARS;
  const canSubmit = reasonValid && walletConnected;
  const buttonDisabled = walletConnected && !reasonValid;

  const handleSubmit = () => {
    if (!canSubmit || !currentAddress) return;

    if (mode === 'dispute') {
      fileLlmDispute(idStr, currentAddress);
    } else {
      fileVoteDispute(idStr, currentAddress);
    }

    router.push(`/assertion/browse/${idStr}`);
  };

  const actionLabel = mode === 'dispute' ? 'Dispute' : 'Challenge';

  const buttonLabel = !walletConnected
    ? `Sign in to ${actionLabel}`
    : !reasonValid
      ? 'Enter a Reason to Continue'
      : `Stake ${bond} USDC & ${actionLabel}`;

  const toggle = (s: Section) => setOpen((prev) => (prev === s ? 'reason' : s));

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
            label="Reason"
            complete={Boolean(reason.trim())}
            open={open === 'reason'}
            onClick={() => toggle('reason')}
            peek={reason || undefined}
            showShortcut={open === 'reason'}
            shortcutHint="Ctrl+Enter"
          />
          <Collapse open={open === 'reason'}>
            <label htmlFor="dispute-reason" className="sr-only">
              Reason
            </label>
            <Textarea
              id="dispute-reason"
              placeholder={
                mode === 'dispute'
                  ? 'Why is this statement false? Cite evidence and sources.'
                  : 'Why is the LLM resolution wrong? Cite evidence and sources.'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON_CHARS))}
              className="min-h-0 flex-1 resize-none text-sm leading-relaxed md:text-sm"
            />
            <div className="mt-3 flex items-center justify-between">
              <AnimatePresence mode="wait">
                {reasonWarning ? (
                  <Warning key="rw" msg={reasonWarning} />
                ) : (
                  <m.span
                    key="rh"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-muted-foreground/85 text-xs md:text-xs"
                  >
                    Kept offchain — shared with resolvers and voters as context.
                  </m.span>
                )}
              </AnimatePresence>
              <span
                className={`font-mono text-xs tabular-nums ${
                  reason.length > MAX_REASON_CHARS * 0.9
                    ? 'text-amber-400'
                    : 'text-muted-foreground/85'
                }`}
              >
                {reason.length} / {MAX_REASON_CHARS}
              </span>
            </div>
          </Collapse>

          <SectionHeader
            label={mode === 'dispute' ? 'Claim Under Dispute' : 'LLM Resolution Under Challenge'}
            complete
            open={open === 'claim'}
            onClick={() => toggle('claim')}
            peek={open !== 'claim' ? assertion.statement : undefined}
            showShortcut={open === 'claim'}
            shortcutHint="Ctrl+Enter"
          />
          <Collapse open={open === 'claim'}>
            <div className="flex h-full flex-col justify-center gap-6">
              <p className="text-foreground max-w-3xl text-lg leading-relaxed md:text-xl">
                {assertion.statement}
              </p>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <SummaryMeta label="You Are Challenging" value={challengedOutcome} />

                <SummaryMeta label="Window Closes" value={getTimeRemaining(deadline)} />

                <SummaryMeta label="Required Bond" value={`${bond} USDC`} />
              </div>

              <p className="text-muted-foreground/85 text-xs">
                {mode === 'dispute'
                  ? 'Filing a dispute routes the statement to the trusted LLM resolver for a verdict under its Resolution Spec.'
                  : 'Challenging the LLM resolution escalates the statement to a private USDC-staked vote.'}
              </p>
            </div>
          </Collapse>

          <SectionHeader
            label="Stake Summary"
            complete={Boolean(reason.trim())}
            open={open === 'summary'}
            onClick={() => toggle('summary')}
            peek={`${bond} USDC · challenging ${challengedOutcome}`}
            showShortcut={open === 'summary'}
            shortcutHint="Ready to submit?"
          />
          <Collapse open={open === 'summary'}>
            <div className="flex h-full flex-col justify-center">
              <div className="mx-auto max-w-3xl text-center">
                <p className="text-foreground text-lg leading-relaxed md:text-xl">
                  {reason.trim() || <span className="text-muted-foreground/45">—</span>}
                </p>
              </div>

              <div className="mx-auto mt-6 grid w-full max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
                <SummaryMeta label="Dispute Bond" value={`${bond} USDC`} accent />

                <SummaryMeta label="Challenging" value={challengedOutcome} />

                <SummaryMeta label="If Correct" value={`+${bond} USDC (minus fee)`} />

                <SummaryMeta label="If Incorrect" value="Bond Slashed" />
              </div>

              <p className="text-muted-foreground/85 mx-auto mt-6 max-w-3xl text-center text-xs">
                If the final outcome is Unresolvable, the dispute settles no-fault — nobody is
                slashed and your bond is returned.
              </p>
            </div>
          </Collapse>

          <div className="border-border mt-auto border-t p-5">
            <m.button
              whileHover={buttonDisabled ? {} : { scale: 1.005 }}
              whileTap={buttonDisabled ? {} : { scale: 0.995 }}
              disabled={buttonDisabled}
              onClick={() => {
                if (!walletConnected) {
                  login();
                  return;
                }
                handleSubmit();
              }}
              className={`w-full py-4 font-mono text-sm tracking-[0.2em] uppercase transition-colors ${
                buttonDisabled
                  ? 'border-border bg-muted/40 text-muted-foreground cursor-not-allowed border'
                  : 'bg-destructive hover:bg-destructive/90 cursor-pointer text-white'
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

function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <m.div
      className="flex flex-col overflow-hidden"
      animate={{ flex: open ? 1 : 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{ minHeight: 0 }}
    >
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-full flex-col p-6"
          >
            {children}
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}

function SummaryMeta({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border-border min-w-0 border-l pl-4">
      <div className="text-muted-foreground/75 font-mono text-[11px] tracking-[0.2em] uppercase">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-base tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}
      >
        {value}
      </div>
    </div>
  );
}
