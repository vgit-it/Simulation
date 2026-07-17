import { useMemo, useState } from 'react';
import { inboxThreads, useStore } from '../../state';
import { resolvePerson } from '../../world';
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
  const { state } = useStore();
  const threads = useMemo(
    () => inboxThreads(state, owner.id),
    [state, owner.id],
  );
  const [openKey, setOpenKey] = useState<string | null>(null);

  const openThread = openKey
    ? threads.find((t) => t.key === openKey)
    : undefined;

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
      <header className="flex items-center justify-between px-5 pb-3 pt-2">
        <h1 className="text-2xl font-bold">Messages</h1>
        <button
          onClick={onClose}
          className="rounded-full bg-text/10 px-3 py-1 text-xs text-muted"
        >
          Home
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {threads.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted">
            No messages yet.
          </p>
        ) : (
          <div className="flex flex-col">
            {threads.map((t) => {
              const people = t.participantIds.map((id) =>
                resolvePerson(owner.id, id),
              );
              const names = people.map((p) => p.name).join(', ');
              const outgoing = t.last.from === owner.id;
              return (
                <button
                  key={t.key}
                  onClick={() => setOpenKey(t.key)}
                  className="flex items-center gap-3 rounded-card px-3 py-3 text-left active:bg-text/5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-text/10 text-xl">
                    {people[0]?.avatar ?? '💬'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {names}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted">
                        {timeLabel(t.last.at)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {outgoing ? 'You: ' : ''}
                      {t.last.body}
                      {t.last.attachments.length > 0 &&
                        ` 📎 ${t.last.attachments.length}`}
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
