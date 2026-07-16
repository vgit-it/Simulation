import { useStore } from '../state';
import { commit, type Proposal } from './index';

interface ProposalSheetProps {
  proposal: Proposal;
  onSent: () => void;
  onCancel: () => void;
}

/**
 * A minimal bottom-sheet that previews a Proposal and lets the user approve it
 * with one tap (Send). This is the seam the M2 assistant surface builds on.
 */
export function ProposalSheet({ proposal, onSent, onCancel }: ProposalSheetProps) {
  const { dispatch } = useStore();
  const canSend = proposal.recipients.length > 0;

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button
        aria-label="Dismiss"
        onClick={onCancel}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative rounded-t-3xl bg-surface p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-text/30" />
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Assistant
        </p>
        <h2 className="mt-1 text-lg font-semibold">{proposal.title}</h2>
        <p className="text-sm text-muted">{proposal.summary}</p>

        {proposal.recipients.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {proposal.recipients.map((r) => (
              <span
                key={r.id}
                className="flex items-center gap-1.5 rounded-full bg-text/10 py-1 pl-1.5 pr-3 text-sm"
              >
                <span className="text-base">{r.avatar}</span>
                {r.name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 rounded-card bg-bg/60 p-3 text-sm text-text/90">
          {proposal.message}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full bg-text/10 py-2.5 text-sm font-medium text-text"
          >
            Cancel
          </button>
          <button
            disabled={!canSend}
            onClick={() => {
              commit(proposal, dispatch);
              onSent();
            }}
            className="flex-1 rounded-full bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
