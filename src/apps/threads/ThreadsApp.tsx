import { useMemo, useState } from 'react';
import { useStore } from '../../state';
import { lastActivity, strandsFor, type Strand } from '../../strands';
import { useConsolidate } from '../../strands/useConsolidate';
import { AppHeader, EmptyState, LAYER, PillButton, useBackHandler } from '../../ui';
import type { AppScreenProps } from '../types';
import { ThreadDetail } from './ThreadDetail';

function timeLabel(at: number): string {
  return new Date(at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const STATUS_STYLES: Record<Strand['status'], string> = {
  active: 'bg-accent/15 text-accent',
  dormant: 'bg-text/10 text-muted',
  done: 'bg-text/5 text-muted/70',
};

/**
 * Threads: the owner's ongoing efforts — what they're part-way through, rather
 * than what they've done. The list is the authored seed
 * (`world/people/<id>/threads.md`) overlaid by whatever the last consolidation
 * produced (`strandsFor`); tapping a thread opens its items in place.
 *
 * It declares no actions, so nothing here is proposable — this app is a
 * window onto the record, and Consolidate is its only verb.
 */
export function ThreadsApp({ owner }: AppScreenProps) {
  const { state } = useStore();
  const strands = useMemo(() => strandsFor(state, owner.id), [state, owner.id]);
  const consolidate = useConsolidate();

  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? strands.find((s) => s.id === openId) : undefined;
  useBackHandler(openId !== null, () => setOpenId(null), LAYER.subview);
  if (open) {
    return (
      <ThreadDetail
        strand={open}
        ownerId={owner.id}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <AppHeader
        title="Threads"
        actions={
          <PillButton onClick={consolidate.run} disabled={consolidate.running}>
            {consolidate.running ? '✨ Working…' : '✨ Consolidate'}
          </PillButton>
        }
      />

      <div className="flex-1 overflow-y-auto overscroll-y-contain px-space-lg pb-space-xl">
        {consolidate.lastReply && (
          <p className="type-caption mb-space-md text-center text-muted">
            {consolidate.lastReply}
          </p>
        )}

        {strands.length === 0 ? (
          <EmptyState
            icon="🧵"
            title="No threads yet"
            hint="Consolidate to gather what you've been working on into threads."
          />
        ) : (
          <div className="flex flex-col gap-space-sm">
            {strands.map((strand, i) => {
              const newest = lastActivity(strand);
              return (
                <button
                  key={strand.id}
                  onClick={() => setOpenId(strand.id)}
                  className="flex animate-rise items-start gap-space-md rounded-card bg-surface p-space-md text-left ring-1 ring-text/5 transition duration-150 active:scale-[0.98]"
                  style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg">
                    {strand.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-space-sm">
                      <span className="type-body min-w-0 flex-1 truncate font-medium">
                        {strand.title}
                      </span>
                      <span
                        className={`type-caption shrink-0 rounded-ds-full px-2 py-0.5 ${STATUS_STYLES[strand.status]}`}
                      >
                        {strand.status}
                      </span>
                    </span>
                    {strand.summary && (
                      <span className="type-body-sm mt-0.5 block text-muted">
                        {strand.summary}
                      </span>
                    )}
                    <span className="type-caption mt-1 block text-muted">
                      {strand.items.length} item
                      {strand.items.length === 1 ? '' : 's'}
                      {newest ? ` · ${timeLabel(newest.at)}` : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
