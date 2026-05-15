import { cn } from '@/lib/utils';
import type { AssertionAccount } from '@/types';

export default function Timeline({ statement }: { statement: AssertionAccount | undefined }) {
  if (!statement) {
    return null;
  }

  const events = [
    {
      date: statement.createdAt,
      title: 'ASSERTED',
      description: 'optimistic truth activated',
      color: 'bg-orange-400',
      active: true,
    },

    ...(statement.llmDispute
      ? [
          {
            date: statement.llmDispute.createdAt,
            title: 'DISPUTED',
            description: 'llm dispute submitted',
            color: 'bg-red-400',
            active: true,
          },
        ]
      : []),

    ...(statement.llmResolutionRound
      ? [
          {
            date: statement.llmResolutionRound.resolvedAt,
            title: 'LLM RESOLUTION',
            description: `proposed ${statement.llmResolutionRound.outcome}`,
            color: 'bg-yellow-400',
            active: true,
          },
        ]
      : []),

    ...(statement.voteDispute
      ? [
          {
            date: statement.voteDispute.createdAt,
            title: 'VOTE CHALLENGE',
            description: `challenged ${statement.voteDispute.challengedLLMResolution}`,
            color: 'bg-purple-400',
            active: true,
          },
        ]
      : []),

    ...(statement.voteResolutionRound
      ? [
          {
            date: statement.voteResolutionRound.votingStartsAt,
            title: 'VOTING OPEN',
            description: `${Number(
              statement.voteResolutionRound.totalValidWeight
            ).toLocaleString()} opal locked`,
            color: 'bg-blue-400',
            active: true,
          },
        ]
      : []),

    {
      date: statement.finalizedAt || statement.livenessDeadline,
      title: statement.finalizedAt ? 'FINALIZED' : 'PENDING FINALIZATION',
      description: statement.finalizedAt
        ? `resolved ${statement.outcome}`
        : 'awaiting next resolution phase',
      color: statement.finalizedAt
        ? statement.outcome === 'True'
          ? 'bg-green-400'
          : statement.outcome === 'False'
            ? 'bg-red-400'
            : 'bg-zinc-400'
        : 'bg-zinc-500',
      active: !!statement.finalizedAt,
    },
  ];

  return (
    <div className="relative flex h-fit w-fit flex-col">
      {events.map((event, index) => {
        const isLast = index === events.length - 1;

        return (
          <div key={`${event.title}-${index}`} className="flex flex-1 flex-col">
            <div className="flex items-start gap-2">
              <div className="flex min-w-35 flex-col items-end">
                <span className="text-muted-foreground text-xs whitespace-nowrap uppercase">
                  {event.date
                    ? new Date(event.date).toLocaleDateString('en-US', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Pending'}
                </span>

                <span
                  className={cn(
                    'text-xs whitespace-nowrap uppercase',
                    event.active ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {event.title}
                </span>

                <span className="text-muted-foreground max-w-35 text-right text-[10px] leading-relaxed uppercase">
                  {event.description}
                </span>
              </div>

              <div className="flex h-full flex-col items-center">
                <span
                  className={cn(
                    'ring-secondary z-10 size-2 shrink-0 rounded-full ring-2',
                    event.color
                  )}
                />

                {!isLast && (
                  <svg
                    width="1"
                    className="mr-0.75 ml-auto h-24 flex-1"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                  >
                    <line
                      x1="0.5"
                      x2="0.5"
                      y1="0"
                      y2="100%"
                      strokeDasharray="4 4"
                      className="stroke-muted-foreground/50"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
