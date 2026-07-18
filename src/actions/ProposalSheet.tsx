import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state';
import { Sheet, prefersReducedMotion } from '../ui';
import { commit, type Proposal } from './index';

interface ProposalSheetProps {
  /** The proposal to preview, or null when nothing is pending (sheet hidden). */
  proposal: Proposal | null;
  onSent: () => void;
  onCancel: () => void;
}

/** How long the "✓ Sent" beat stays on screen before the sheet dismisses. */
const SENT_BEAT_MS = 700;

/**
 * A bottom-sheet that previews a Proposal and lets the user approve it with one
 * tap — or edit it first: the message text is editable in place and recipients
 * are removable chips. Edits go through the proposal's own `amend`, which
 * re-derives the events, so what's on screen is exactly what commits. Render it
 * unconditionally with a nullable proposal; it animates itself in and out.
 */
export function ProposalSheet({ proposal, onSent, onCancel }: ProposalSheetProps) {
  const { dispatch } = useStore();
  const [sent, setSent] = useState(false);
  // The user's edited version of the incoming proposal (reset per proposal).
  const [edited, setEdited] = useState<Proposal | null>(null);
  // Keep the last proposal so the content stays visible during the slide-down
  // exit after send/cancel clears it.
  const lastRef = useRef<Proposal | null>(null);
  if (proposal) lastRef.current = proposal;
  const incoming = proposal ?? lastRef.current;
  const shown = edited ?? incoming;

  useEffect(() => {
    if (proposal) {
      setSent(false);
      setEdited(null);
    }
  }, [proposal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSend() {
    if (!proposal) return;
    // State correctness first: commit immediately, never gated on animation.
    commit(edited ?? proposal, dispatch);
    setSent(true);
    setTimeout(onSent, prefersReducedMotion() ? 0 : SENT_BEAT_MS);
  }

  function editMessage(text: string) {
    if (shown?.amend) setEdited(shown.amend({ message: text }));
  }

  function removeRecipient(id: string) {
    if (!shown?.amend) return;
    setEdited(
      shown.amend({
        recipientIds: shown.recipients.filter((r) => r.id !== id).map((r) => r.id),
      }),
    );
  }

  if (!shown) return null;
  const canSend = !shown.invalidReason;
  const editable = Boolean(shown.amend) && !sent;
  const confirmLabel = shown.confirmLabel ?? 'Send';
  const doneLabel = confirmLabel === 'Send' ? '✓ Sent' : '✓ Done';

  return (
    <Sheet open={proposal !== null} onDismiss={sent ? () => {} : onCancel}>
      <p className="type-caption text-accent">Assistant</p>
      <h2 className="type-title mt-1">{shown.title}</h2>
      <p className="type-body-sm mt-0.5 text-muted">{shown.summary}</p>

      {shown.recipients.length > 0 && (
        <div className="mt-space-md flex flex-wrap gap-space-sm">
          {shown.recipients.map((r) => (
            <span
              key={r.id}
              className="type-body-sm flex items-center gap-1.5 rounded-ds-full bg-text/10 py-1 pl-1.5 pr-2"
            >
              <span className="text-base">{r.avatar}</span>
              {r.name}
              {editable && (
                <button
                  aria-label={`Remove ${r.name}`}
                  onClick={() => removeRecipient(r.id)}
                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-text/10 text-[10px] text-muted transition duration-150 active:scale-90"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {editable ? (
        <textarea
          value={shown.message}
          onChange={(e) => editMessage(e.target.value)}
          rows={3}
          aria-label="Edit message"
          className="type-body mt-space-md w-full resize-none rounded-card bg-bg/60 p-space-md text-text/90 ring-1 ring-text/5 focus:outline-none focus:ring-accent/40"
        />
      ) : (
        <div className="type-body mt-space-md rounded-card bg-bg/60 p-space-md text-text/90 ring-1 ring-text/5">
          {shown.message}
        </div>
      )}

      {shown.invalidReason && (
        <p className="type-caption mt-space-sm text-muted">
          ⚠️ {shown.invalidReason}
        </p>
      )}

      <div className="mt-space-xl flex gap-space-md">
        <button
          onClick={onCancel}
          disabled={sent}
          className={`type-label flex-1 rounded-ds-full bg-text/10 py-2.5 text-text transition duration-150 ease-out-soft active:scale-95 ${
            sent ? 'opacity-40' : ''
          }`}
        >
          Cancel
        </button>
        <button
          disabled={!canSend || sent}
          onClick={onSend}
          className={`type-label flex-1 rounded-ds-full bg-accent py-2.5 text-white transition duration-150 ease-out-soft active:scale-95 ${
            !canSend ? 'opacity-40' : ''
          }`}
        >
          {sent ? (
            <span className="inline-block animate-pop">{doneLabel}</span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Sheet>
  );
}
