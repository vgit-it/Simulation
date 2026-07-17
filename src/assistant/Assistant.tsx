import { useMemo, useState } from 'react';
import { propose, type Proposal } from '../actions';
import { ProposalSheet } from '../actions/ProposalSheet';
import { assembleContext } from '../context';
import { intelligenceFor, type Suggestion } from '../intelligence';
import { useSession } from '../session';
import { messagesFrom, useNow, useStore } from '../state';
import { Sheet } from '../ui';
import { getPerson, resolvePerson } from '../world';

/**
 * The persistent assistant: a floating button that opens a sheet of proactive
 * suggestions (one tap -> a Proposal you approve) plus a running activity feed of
 * what's been sent. Built entirely on the M1.5 pipeline — new UI, no new plumbing
 * beyond the brain's `suggestShares`.
 */
export function Assistant() {
  const { session } = useSession();
  const { state } = useStore();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const owner = getPerson(session.personId);
  const suggestions = useMemo(
    () => intelligenceFor(session.personId).suggestShares(owner.gallery, now),
    [session.personId, owner.gallery, now],
  );
  const activity = messagesFrom(state, session.personId);

  function onSuggestion(s: Suggestion) {
    const ctx = assembleContext(session, state, {
      photoIds: s.photos.map((p) => p.id),
    });
    setProposal(propose(s.intent, ctx, s.photos));
  }

  return (
    <>
      {/* Entrance pop lives on the wrapper so its fill-mode can't pin the
          button's transform, which the open/close scale toggle animates. */}
      <span
        className="absolute bottom-24 right-5 z-20 block animate-pop"
        style={{ animationDelay: '350ms' }}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-fab transition duration-200 ease-out-soft active:scale-90 ${
            open ? 'pointer-events-none scale-0 opacity-0' : 'scale-100 opacity-100'
          }`}
        >
          ✨
          {suggestions.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 animate-pop rounded-full bg-white ring-[3px] ring-accent" />
          )}
        </button>
      </span>

      <Sheet
        open={open}
        onDismiss={() => setOpen(false)}
        dismissLabel="Close assistant"
        maxHeightClass="max-h-[85%]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">✨ Assistant</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full bg-text/10 px-3 py-1 text-xs text-muted transition duration-150 active:scale-95"
          >
            Close
          </button>
        </div>

        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
          Suggestions
        </h3>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted">Nothing to suggest right now.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => onSuggestion(s)}
                className="flex animate-rise items-center gap-3 rounded-card bg-bg/60 p-3 text-left ring-1 ring-text/5 transition duration-150 active:scale-[0.98]"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="text-xl">📷</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{s.title}</span>
                  {s.subtitle && (
                    <span className="block truncate text-xs text-muted">
                      {s.subtitle}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
          Recent activity
        </h3>
        {activity.length === 0 ? (
          <p className="text-sm text-muted">No messages sent yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {[...activity].reverse().map((m, i) => {
              const names = m.to
                .map((id) => resolvePerson(session.personId, id).name)
                .join(', ');
              return (
                <div
                  key={m.id}
                  className="animate-rise rounded-card bg-bg/60 p-3 ring-1 ring-text/5"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <p className="text-xs text-muted">To {names}</p>
                  <p className="mt-0.5 text-sm">{m.body}</p>
                  {m.attachments.length > 0 && (
                    <p className="mt-1 text-xs text-accent">
                      📎 {m.attachments.length} photo
                      {m.attachments.length === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Sheet>

      <ProposalSheet
        proposal={proposal}
        onSent={() => setProposal(null)}
        onCancel={() => setProposal(null)}
      />
    </>
  );
}
