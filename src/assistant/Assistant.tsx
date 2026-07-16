import { useMemo, useState } from 'react';
import { propose, type Proposal } from '../actions';
import { ProposalSheet } from '../actions/ProposalSheet';
import { assembleContext } from '../context';
import { intelligenceFor, type Suggestion } from '../intelligence';
import { useSession } from '../session';
import { messagesFrom, useNow, useStore } from '../state';
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
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="absolute bottom-24 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg shadow-black/40 active:scale-95"
        >
          ✨
        </button>
      )}

      {open && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end">
          <button
            aria-label="Close assistant"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative max-h-[85%] overflow-y-auto rounded-t-3xl bg-surface p-5 pb-8 shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-text/30" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">✨ Assistant</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full bg-text/10 px-3 py-1 text-xs text-muted"
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
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSuggestion(s)}
                    className="flex items-center gap-3 rounded-card bg-bg/60 p-3 text-left active:opacity-80"
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
                {[...activity].reverse().map((m) => {
                  const names = m.to
                    .map((id) => resolvePerson(session.personId, id).name)
                    .join(', ');
                  return (
                    <div key={m.id} className="rounded-card bg-bg/60 p-3">
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
          </div>
        </div>
      )}

      {proposal && (
        <ProposalSheet
          proposal={proposal}
          onSent={() => setProposal(null)}
          onCancel={() => setProposal(null)}
        />
      )}
    </>
  );
}
