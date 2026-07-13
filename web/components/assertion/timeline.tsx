import { cn } from '@/lib/utils';
import type { AssertionAccount } from '@/types';

// Horizontal lifecycle timeline card. The detail page pins it in-flow at the bottom of
// its fixed-height layout so it never overlaps the content above.
export default function Timeline({ statement }: { statement: AssertionAccount | undefined }) {
  if (!statement) {
    return null;
  }

  const events = [
    {
      date: statement.createdAt,
      title: 'ASSERTED',
      description: 'Optimistic truth activated',
      active: true,
    },

    ...(statement.llmDispute
      ? [
          {
            date: statement.llmDispute.createdAt,
            title: 'DISPUTED',
            description: 'LLM dispute submitted',
            active: true,
          },
        ]
      : []),

    ...(statement.llmResolutionRound
      ? [
          {
            date: statement.llmResolutionRound.resolvedAt,
            title: 'LLM RESOLUTION',
            description: `Proposed ${statement.llmResolutionRound.outcome}`,
            active: true,
          },
        ]
      : []),

    ...(statement.voteDispute
      ? [
          {
            date: statement.voteDispute.createdAt,
            title: 'VOTE CHALLENGE',
            description: `Challenged ${statement.voteDispute.challengedLLMResolution}`,
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
            ).toLocaleString()} vote weight locked`,
            active: true,
          },
        ]
      : []),

    {
      date: statement.finalizedAt || statement.livenessDeadline,
      title: statement.finalizedAt ? 'FINALIZED' : 'PENDING FINALIZATION',
      description: statement.finalizedAt
        ? `Resolved ${statement.outcome}`
        : 'Awaiting next resolution phase',
      active: !!statement.finalizedAt,
    },
  ];

  const completed = events.filter((event) => event.active).length;

  return (
    <div className="w-full">
      <div className="border-border bg-background/85 border-t px-6 pt-4 pb-5 backdrop-blur-md">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground/75 font-mono text-[10px] tracking-[0.3em] uppercase">
            Lifecycle
          </span>

          <span className="text-muted-foreground/60 font-mono text-[10px] tracking-widest uppercase tabular-nums">
            {completed} / {events.length} steps
          </span>
        </div>

        <div className="no-scrollbar mt-4 flex overflow-x-auto">
          {events.map((event, index) => {
            const isFirst = index === 0;
            const isLast = index === events.length - 1;

            return (
              <div
                key={`${event.title}-${index}`}
                className="flex min-w-44 flex-1 flex-col items-center gap-3"
              >
                <div className="flex w-full items-center">
                  <span
                    className={cn(
                      'h-px flex-1',
                      isFirst
                        ? 'bg-transparent'
                        : event.active
                          ? 'bg-primary/50'
                          : 'bg-muted-foreground/20'
                    )}
                  />

                  <span
                    className={cn(
                      'z-10 mx-2 size-2 shrink-0 rotate-45',
                      event.active
                        ? 'bg-primary'
                        : 'border-muted-foreground/50 border bg-transparent'
                    )}
                  />

                  <span
                    className={cn(
                      'h-px flex-1',
                      isLast
                        ? 'bg-transparent'
                        : events[index + 1]?.active
                          ? 'bg-primary/50'
                          : 'bg-muted-foreground/20'
                    )}
                  />
                </div>

                <div className="flex flex-col items-center gap-1 px-4 text-center">
                  <span
                    className={cn(
                      'font-mono text-xs tracking-[0.15em] whitespace-nowrap uppercase',
                      event.active ? 'text-foreground' : 'text-muted-foreground/70'
                    )}
                  >
                    {event.title}
                  </span>

                  <span className="text-muted-foreground/70 font-mono text-[10px] whitespace-nowrap uppercase tabular-nums">
                    {event.date
                      ? new Date(event.date).toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Pending'}
                  </span>

                  <span className="text-muted-foreground/60 text-xs leading-relaxed whitespace-nowrap">
                    {event.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
