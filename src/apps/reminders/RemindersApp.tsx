import { useMemo, useState, type FormEvent } from 'react';
import { commit, propose } from '../../actions';
import { assembleContext } from '../../context';
import { useSession } from '../../session';
import { remindersFor, useStore } from '../../state';
import { AppHeader, EmptyState, PillButton } from '../../ui';
import { resolveAsset } from '../../world';
import type { AppScreenProps } from '../types';

function timeLabel(at: number): string {
  return new Date(at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Reminders: the owner's to-dos, derived from ReminderCreated events. Adding
 * one directly goes through the same propose→commit pipeline the assistant's
 * `create-reminder` plan step uses — typed by the user, so it commits without
 * an approval sheet (you don't approve your own words).
 */
export function RemindersApp({ owner, onClose }: AppScreenProps) {
  const { session } = useSession();
  const { state, dispatch } = useStore();
  const reminders = useMemo(
    () => remindersFor(state, owner.id),
    [state, owner.id],
  );
  const [draft, setDraft] = useState('');

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    const ctx = assembleContext(session, state, { app: 'reminders' });
    commit(propose('create-reminder', ctx, [], { title }), dispatch);
    setDraft('');
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <AppHeader
        title="Reminders"
        actions={<PillButton onClick={onClose}>Home</PillButton>}
      />

      <div className="flex-1 overflow-y-auto px-space-lg pb-space-xl">
        {reminders.length === 0 ? (
          <EmptyState
            icon="⏰"
            title="No reminders"
            hint="Add one below, or ask the assistant to remind you."
          />
        ) : (
          <div className="flex flex-col gap-space-sm">
            {reminders.map((r, i) => {
              const related = r.related
                .map((id) => resolveAsset(r.person, id))
                .filter((p): p is NonNullable<typeof p> => Boolean(p));
              return (
                <div
                  key={r.id}
                  className="flex animate-rise items-center gap-space-md rounded-card bg-surface p-space-md ring-1 ring-text/5"
                  style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
                >
                  <span className="h-4 w-4 shrink-0 rounded-full ring-2 ring-accent/60" />
                  <span className="min-w-0 flex-1">
                    <span className="type-body block">{r.title}</span>
                    <span className="type-caption mt-0.5 block text-muted">
                      {timeLabel(r.at)}
                    </span>
                  </span>
                  {related.length > 0 && (
                    <span className="flex shrink-0 items-center gap-1">
                      {related.slice(0, 3).map((p) => (
                        <img
                          key={p.id}
                          src={p.url}
                          alt=""
                          className="h-8 w-8 rounded-ds-xs object-cover ring-1 ring-text/10"
                        />
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form
        onSubmit={onAdd}
        className="flex gap-space-sm border-t border-text/5 bg-surface/95 px-space-lg py-space-md backdrop-blur"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Remind me to..."
          className="type-body-sm min-w-0 flex-1 rounded-ds-full bg-bg/60 px-space-lg py-2 text-text ring-1 ring-text/10 placeholder:text-muted focus:outline-none"
        />
        <PillButton variant="accent" disabled={!draft.trim()} className="shrink-0">
          Add
        </PillButton>
      </form>
    </div>
  );
}
