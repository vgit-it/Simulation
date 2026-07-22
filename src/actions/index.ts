import type { ContextBundle } from '../context';
import type { ResolvedPerson } from '../intelligence';
import type { SimEvent } from '../state';
import { capabilityFor, type ActionPayload, type Stakes } from './capabilities';

/**
 * The single action/intent pipeline shared by the assistant and scenarios:
 * `propose(intent, ctx, payload) -> Proposal` builds a previewable proposal
 * WITHOUT mutating anything; `commit(proposal, dispatch)` emits its events.
 * The assistant renders the Proposal and calls commit on "Send".
 *
 * What intents exist — and how each builds its Proposal — lives in the
 * capability registry (`./capabilities`), which is generated from the apps'
 * authored `actions:` frontmatter. Adding an intent = declare it in the app's
 * world file + register one implementation there; this module doesn't change.
 *
 * Hybrid model: the proposal's *content* (message text, chosen recipients) comes
 * from the brain today and can become LLM-generated later; the pipeline shape
 * and commit path stay fixed.
 */
/** A user's edit to a drafted proposal before committing it. */
export interface ProposalEdit {
  /** Replacement body text (message text / reminder title). */
  message?: string;
  /** Replacement recipient ids (e.g. after removing a chip). */
  recipientIds?: string[];
}

export interface Proposal {
  id: string;
  intent: string;
  /**
   * The effective stakes of committing this proposal. `high` must pass a
   * consent gate even under `auto`/`confirm-once` supervision — the
   * non-waivable floor (alongside `invalidReason`); `low` commits freely.
   */
  stakes: Stakes;
  title: string;
  summary: string;
  recipients: ResolvedPerson[];
  message: string;
  attachments: string[];
  /** Events emitted on commit. */
  events: SimEvent[];
  /** Why this proposal can't commit right now (disables the confirm button). */
  invalidReason?: string;
  /** Confirm-button label; defaults to 'Send'. */
  confirmLabel?: string;
  /**
   * Re-derive this proposal with a user's edits applied — display fields AND
   * events, so what you see is exactly what commits. Each capability supplies
   * its own amend (it knows its event shapes); absent = not editable.
   */
  amend?: (edit: ProposalEdit) => Proposal;
}

export {
  capabilityFor,
  effectiveStakes,
  listCapabilities,
  viableCapabilities,
  type ActionPayload,
  type Capability,
  type Stakes,
} from './capabilities';

export {
  absorbAnswer,
  acceptGap,
  bandFor,
  bindGapValue,
  candidate,
  DEFAULT_SUPERVISION,
  firstPlanGap,
  meetsThreshold,
  missingSlots,
  resolvePlanSlots,
  type Candidate,
  type Confidence,
  type PlanGap,
  type Slot,
  type SlotBand,
  type SlotResolver,
} from './requirements';

export {
  parseSlotAnswer,
  valueKindParser,
  type ParseInput,
  type ValueKindParser,
} from './valueKinds';

/**
 * Build a proposal for an intent via the capability registry. `ids` are the
 * object ids the action operates on (photos, people, ...); `payload` carries
 * free-form inputs (message text, a reminder title).
 */
export function propose(
  intent: string,
  ctx: ContextBundle,
  ids: string[],
  payload?: ActionPayload,
): Proposal {
  return capabilityFor(intent).propose(ctx, ids, payload);
}

/** Commit a proposal by emitting its events. */
export function commit(
  proposal: Proposal,
  dispatch: (event: SimEvent) => void,
): void {
  proposal.events.forEach(dispatch);
}
