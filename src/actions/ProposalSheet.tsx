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
 * tap (Send). This is the seam the M2 assistant surface builds on. Render it
 * unconditionally with a nullable proposal; it animates itself in and out.
 */
export function ProposalSheet({ proposal, onSent, onCancel }: ProposalSheetProps) {
  const { dispatch } = useStore();
  const [sent, setSent] = useState(false);
  // Keep the last proposal so the content stays visible during the slide-down
  // exit after send/cancel clears it.
  const lastRef = useRef<Proposal | null>(null);
  if (proposal) lastRef.current = proposal;
  const shown = proposal ?? lastRef.current;

  useEffect(() => {
    if (proposal) setSent(false);
  }, [proposal]);

  function onSend() {
    if (!proposal) return;
    // State correctness first: commit immediately, never gated on animation.
    commit(proposal, dispatch);
    setSent(true);
    setTimeout(onSent, prefersReducedMotion() ? 0 : SENT_BEAT_MS);
  }

  if (!shown) return null;
  const canSend = !shown.invalidReason;
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
              className="type-body-sm flex items-center gap-1.5 rounded-ds-full bg-text/10 py-1 pl-1.5 pr-3"
            >
              <span className="text-base">{r.avatar}</span>
              {r.name}
            </span>
          ))}
        </div>
      )}

      <div className="type-body mt-space-md rounded-card bg-bg/60 p-space-md text-text/90 ring-1 ring-text/5">
        {shown.message}
      </div>

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
