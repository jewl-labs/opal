'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { CheckCircleIcon, LinkBreakIcon, SealCheckIcon } from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { getOutcomeLabel } from '@/lib/assertion-labels';
import { getTimeRemaining, isDeadlinePast } from '@/lib/helpers';
import type { AssertionAccount, ResolutionOutcome } from '@/types';

const OUTCOMES: ResolutionOutcome[] = ['True', 'False', 'Unresolvable'];

interface DisputeActionProps {
  assertion: AssertionAccount;
  userVote: ResolutionOutcome | null;
  onSubmitLlmResolution: (outcome: ResolutionOutcome) => void;
  onOpenVote: () => void;
  onFinalize: () => void;
}

// The single "what happens now" card on the detail page. One prominent panel per
// state — everything else on the page is secondary record.
export default function DisputeAction({
  assertion,
  userVote,
  onSubmitLlmResolution,
  onOpenVote,
  onFinalize,
}: DisputeActionProps) {
  const disputeHref = `/assertion/browse/${assertion.id}/dispute`;
  const voteHref = `/assertion/browse/${assertion.id}/vote`;

  if (assertion.state === 'Asserted') {
    if (isDeadlinePast(assertion.livenessDeadline)) {
      return (
        <Panel
          eyebrow="Action Available"
          title="Liveness Window Expired"
          note="No dispute was filed before the liveness deadline. Anyone can now finalize the assertion with the default TRUE outcome (mirrors finalize_undisputed — permissionless)."
        >
          <Button size="lg" onClick={onFinalize}>
            Finalize as TRUE
          </Button>
        </Panel>
      );
    }

    return (
      <Panel
        eyebrow="Dispute Window Open"
        title="Disagree With This Statement?"
        note={`Liveness closes in ${getTimeRemaining(assertion.livenessDeadline)}. Filing a dispute challenges the default TRUE outcome and routes the statement to LLM resolution.`}
      >
        <DisputeLink href={disputeHref} label="Dispute Statement" />
      </Panel>
    );
  }

  if (assertion.state === 'PendingLLM') {
    return (
      <Panel
        eyebrow="Awaiting Resolution"
        title="Awaiting LLM Verdict"
        note="This assertion has been disputed. The trusted LLM resolver reviews the statement under its Resolution Spec and posts a verdict on-chain (mirrors submit_llm_resolution). Mock: pick the resolver's verdict."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {OUTCOMES.map((outcome) => (
            <Button
              key={outcome}
              onClick={() => onSubmitLlmResolution(outcome)}
              variant="outline"
              size="lg"
            >
              {getOutcomeLabel(outcome)}
            </Button>
          ))}
        </div>
      </Panel>
    );
  }

  if (assertion.state === 'AssertedLLM') {
    if (isDeadlinePast(assertion.llmResolutionRound?.challengeDeadline)) {
      return (
        <Panel
          eyebrow="Action Available"
          title="Challenge Window Expired"
          note={`LLM proposed ${assertion.llmResolutionRound?.outcome ?? 'Unknown'} and no challenge was filed. Anyone can now finalize the assertion with the LLM outcome and settle the first dispute (mirrors finalize_llm_resolution).`}
        >
          <Button size="lg" onClick={onFinalize}>
            Finalize LLM Resolution
          </Button>
        </Panel>
      );
    }

    return (
      <Panel
        eyebrow="Challenge Window Open"
        title={`LLM Proposed ${getOutcomeLabel(assertion.llmResolutionRound?.outcome ?? null)}`}
        note={`Challenge window closes in ${getTimeRemaining(
          assertion.llmResolutionRound?.challengeDeadline ?? undefined
        )}. Challenging escalates the assertion to a private USDC-staked vote.`}
      >
        <DisputeLink href={disputeHref} label="Challenge LLM Resolution" />
      </Panel>
    );
  }

  if (assertion.state === 'PendingVote') {
    return (
      <Panel
        eyebrow="Vote Setup"
        title="Vote Setup In Progress"
        note="The LLM resolution has been challenged. Voting opens once the vote round is initialized (permissionless — anyone can open it)."
      >
        <Button size="lg" onClick={onOpenVote} variant="outline">
          Open Vote
        </Button>
      </Panel>
    );
  }

  if (assertion.state === 'Voting') {
    if (!isDeadlinePast(assertion.voteResolutionRound?.votingDeadline)) {
      const closesIn = getTimeRemaining(assertion.voteResolutionRound?.votingDeadline ?? undefined);

      if (userVote) {
        return (
          <Panel
            eyebrow="Voting Live"
            title={
              <span className="flex items-center gap-3">
                <CheckCircleIcon size={28} weight="fill" className="text-primary" />
                Your Vote Is In: {getOutcomeLabel(userVote)}
              </span>
            }
            note={`Voting closes in ${closesIn}. An outcome that reaches a supermajority becomes final once the window ends — otherwise the vote settles Unresolvable.`}
          >
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href={voteHref} />}
            >
              View Live Tally
            </Button>
          </Panel>
        );
      }

      return (
        <Panel
          eyebrow="Voting Live"
          title="Staked Voting Is Live"
          note={`Voting closes in ${closesIn}. Stake USDC to vote (1 USDC = 1 vote) — an outcome that reaches a supermajority becomes final, otherwise the vote settles Unresolvable.`}
        >
          <Button size="lg" nativeButton={false} render={<Link href={voteHref} />}>
            Cast Your Vote
          </Button>
        </Panel>
      );
    }

    return (
      <Panel
        eyebrow="Action Available"
        title="Voting Closed"
        note="The voting window has ended. Anyone can now finalize the vote resolution — an outcome with a supermajority becomes final (otherwise Unresolvable) and both disputes settle (mirrors finalize_vote_resolution)."
      >
        <Button size="lg" onClick={onFinalize}>
          Finalize Vote Resolution
        </Button>
      </Panel>
    );
  }

  if (assertion.state === 'Resolved') {
    const resolutionPath =
      assertion.disputeCount === 2
        ? 'Staked Vote'
        : assertion.disputeCount === 1
          ? 'LLM Resolution'
          : 'Optimistic (Undisputed)';

    return (
      <Panel
        eyebrow="Settled"
        title={
          <span className="flex items-center gap-3">
            <SealCheckIcon size={28} weight="fill" className="text-primary" />
            Final Outcome: {getOutcomeLabel(assertion.outcome)}
          </span>
        }
        note="This assertion is finalized. The outcome is irreversible and bonds have been settled — integrators can safely consume it."
      >
        <div className="flex flex-wrap items-start justify-center gap-x-14 gap-y-6">
          <SettlementMeta label="Resolution Path" value={resolutionPath} />

          {assertion.finalizedAt && (
            <SettlementMeta
              label="Finalized"
              value={new Date(assertion.finalizedAt).toLocaleDateString()}
            />
          )}

          {assertion.llmDispute && (
            <SettlementMeta label="First Dispute" value={settlementLabel(assertion.llmDispute)} />
          )}

          {assertion.voteDispute && (
            <SettlementMeta label="Second Dispute" value={settlementLabel(assertion.voteDispute)} />
          )}
        </div>
      </Panel>
    );
  }

  return null;
}

// An Unresolvable settlement is no-fault: the bond is returned and nobody is slashed,
// so disputeCorrect stays null even though the dispute is settled.
function settlementLabel(dispute: {
  settled: boolean;
  disputeCorrect: boolean | null;
  settlementResolution: ResolutionOutcome | null;
}) {
  if (!dispute.settled) return 'Unsettled';
  if (dispute.settlementResolution === 'Unresolvable') return 'No Fault — Bond Returned';
  if (dispute.disputeCorrect === null) return 'Unsettled';
  return dispute.disputeCorrect ? 'Correct — Bond Won' : 'Incorrect — Bond Slashed';
}

function SettlementMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
        {label}
      </span>

      <span className="font-mono text-sm break-all uppercase tabular-nums">{value}</span>
    </div>
  );
}

function DisputeLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="destructive" size="lg" nativeButton={false} render={<Link href={href} />}>
      <LinkBreakIcon />
      {label}
    </Button>
  );
}

function Panel({
  eyebrow,
  title,
  note,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  note: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-border bg-card/40 w-full border px-8 py-7 md:px-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-primary font-mono text-xs tracking-[0.25em] uppercase">
          {eyebrow}
        </span>

        <h2 className="text-xl uppercase md:text-2xl">{title}</h2>

        <p className="text-muted-foreground/80 max-w-2xl text-sm leading-relaxed">{note}</p>

        {children && <div className="flex justify-center pt-2">{children}</div>}
      </div>
    </section>
  );
}
