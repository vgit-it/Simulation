import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../../session';
import { inboxThreads, unreadThreadKeys, useStore } from '../../state';
import { AppHeader, Avatar, EmptyState, PillButton } from '../../ui';
import { resolveAsset, resolvePerson } from '../../world';
import type { AppScreenProps } from '../types';
import { Thread } from './Thread';

function timeLabel(at: number): string {
  return new Date(at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Messages: the owner's inbox. Threads are derived from the global event log
 * (`inboxThreads`), so a share sent by anyone to this person "arrives" here the
 * moment you embody them — no per-person mailbox plumbing, just a fold over the
 * log. Read-only for M3 (replying is a natural M4 follow-on).
 */
export function MessagesApp({ owner, onClose }: AppScreenProps) {
  const { setSelection } = useSession();
  const { state, dispatch } = useStore();
  const threads = useMemo(
    () => inboxThreads(state, owner.id),
    [state, owner.id],
  );
  const unread = useMemo(
    () => unreadThreadKeys(state, owner.id),
    [state, owner.id],
  );
  const [openKey, setOpenKey] = useState<string | null>(null);

  const openThread = openKey
    ? threads.find((t) => t.key === openKey)
    : undefined;

  // Reading is an event: opening a thread (or new messages arriving while it's
  // open) records ThreadRead, which clears the badge everywhere.
  const openLastAt = openThread?.last.at;
  useEffect(() => {
    if (!openKey || openLastAt === undefined) return;
    dispatch({
      type: 'ThreadRead',
      at: state.clock,
      person: owner.id,
      thread: openKey,
    });
    // Keyed on the thread + its newest message, not the whole state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, openLastAt, owner.id]);

  // The open thread's participants ARE the selection — "reply to them" /
  // "share these with them" binds to whoever this conversation is with.
  const participantsKey = openThread?.participantIds.join('+') ?? null;
  useEffect(() => {
    setSelection(
      participantsKey
        ? { app: 'messages', kind: 'people', ids: participantsKey.split('+') }
        : null,
    );
  }, [participantsKey, setSelection]);
  useEffect(() => () => setSelection(null), [setSelection]);

  if (openThread) {
    return (
      <Thread
        thread={openThread}
        ownerId={owner.id}
        onBack={() => setOpenKey(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <AppHeader
        title="Messages"
        actions={<PillButton onClick={onClose}>Home</PillButton>}
      />

      <div className="flex-1 overflow-y-auto px-space-sm pb-space-xl">
        {threads.length === 0 ? (
          <EmptyState
            icon="💬"
            title="No messages yet"
            hint="Shares sent to this person land here."
          />
        ) : (
          <div className="flex flex-col">
            {threads.map((t, i) => {
              const people = t.participantIds.map((id) =>
                resolvePerson(owner.id, id),
              );
              const names = people.map((p) => p.name).join(', ');
              const outgoing = t.last.from === owner.id;
              const isUnread = unread.has(t.key);
              const previewAssets = t.last.attachments
                .slice(0, 3)
                .map((assetId) => resolveAsset(t.last.from, assetId))
                .filter((p): p is NonNullable<typeof p> => Boolean(p));
              const overflow = t.last.attachments.length - previewAssets.length;
              return (
                <button
                  key={t.key}
                  onClick={() => setOpenKey(t.key)}
                  className="flex animate-rise items-center gap-space-md rounded-card px-space-md py-space-md text-left transition-colors duration-150 active:bg-text/5"
                  style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
                >
                  <span className="relative">
                    <Avatar emoji={people[0]?.avatar ?? '💬'} />
                    {isUnread && (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pop rounded-full bg-accent ring-2 ring-bg" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-space-sm">
                      <span
                        className={`type-body truncate ${
                          isUnread ? 'font-semibold text-text' : 'font-medium'
                        }`}
                      >
                        {names}
                      </span>
                      <span className="type-caption shrink-0 text-muted">
                        {timeLabel(t.last.at)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span className="type-body-sm min-w-0 truncate text-muted">
                        {outgoing ? 'You: ' : ''}
                        {t.last.body}
                      </span>
                      {previewAssets.length > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5">
                          {previewAssets.map((p) => (
                            <img
                              key={p.id}
                              src={p.url}
                              alt=""
                              className="h-4 w-4 rounded-[4px] object-cover"
                            />
                          ))}
                          {overflow > 0 && (
                            <span className="type-caption text-muted">
                              +{overflow}
                            </span>
                          )}
                        </span>
                      )}
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
