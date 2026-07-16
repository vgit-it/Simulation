import type { ContextBundle } from '../context';
import type { ResolvedPerson } from '../intelligence';
import { uid, type SimEvent } from '../state';
import type { Photo } from '../world';

/**
 * The single action/intent pipeline shared by the assistant and (later)
 * scenarios: `propose(intent, ctx, payload) -> Proposal` builds a previewable
 * proposal WITHOUT mutating anything; `commit(proposal, dispatch)` emits its
 * events. The assistant renders the Proposal and calls commit on "Send".
 *
 * Hybrid model: the proposal's *content* (message text, chosen recipients) comes
 * from the brain today and can become LLM-generated later; the pipeline shape
 * and commit path stay fixed.
 */
export interface Proposal {
  id: string;
  intent: string;
  title: string;
  summary: string;
  recipients: ResolvedPerson[];
  message: string;
  attachments: string[];
  /** Events emitted on commit. */
  events: SimEvent[];
}

function proposeShare(ctx: ContextBundle, photos: Photo[]): Proposal {
  const draft = ctx.brain.draftShare(photos);
  const at = ctx.now.getTime();
  const attachments = photos.map((p) => p.id);
  const to = draft.recipients.map((r) => r.id);

  const events: SimEvent[] = [
    {
      type: 'MessageSent',
      id: uid('msg'),
      at,
      from: ctx.owner.id,
      to,
      body: draft.message,
      attachments,
      intent: 'share-photos',
    },
    ...draft.recipients.map(
      (r): SimEvent => ({
        type: 'FactRecorded',
        at,
        person: ctx.owner.id,
        key: 'last-shared-with',
        value: r.id,
      }),
    ),
  ];

  const count = photos.length;
  return {
    id: uid('prop'),
    intent: 'share-photos',
    title: `Share ${count} photo${count === 1 ? '' : 's'}`,
    summary: draft.recipients.length
      ? `With ${draft.recipients.map((r) => r.name).join(', ')}`
      : 'No one else is in these photos',
    recipients: draft.recipients,
    message: draft.message,
    attachments,
    events,
  };
}

/** Build a proposal for an intent. Add new intents here as they arrive. */
export function propose(
  intent: string,
  ctx: ContextBundle,
  photos: Photo[],
): Proposal {
  switch (intent) {
    case 'share-photos':
      return proposeShare(ctx, photos);
    default:
      throw new Error(`Unknown intent: ${intent}`);
  }
}

/** Commit a proposal by emitting its events. */
export function commit(
  proposal: Proposal,
  dispatch: (event: SimEvent) => void,
): void {
  proposal.events.forEach(dispatch);
}
