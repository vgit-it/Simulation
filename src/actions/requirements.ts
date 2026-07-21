import type { ContextBundle } from '../context';
import type { Plan } from '../plans/types';
import { capabilityFor, type ActionPayload } from './capabilities';

/**
 * Slot-filling: once an intent is known, what inputs does it still need?
 *
 * An action's requirements are its `slots` — either the operand SELECTION
 * (which photos, which people) or a free-form PAYLOAD value (recipients,
 * message text, a reminder title). A slot is declared in the app's world file
 * (`world/apps/*.md` — the WHAT + the question to ask), and RESOLVED in code
 * (the HOW — a capability supplies a resolver for slots with a smart default,
 * e.g. share recipients drafted from the photo's tags; the rest fall back to a
 * generic "is this value present" check). This mirrors the capability registry:
 * declaration in content, implementation in code, joined at load.
 *
 * The assistant uses this to turn "share this" (with nobody to send to) into a
 * targeted question — "Who should I share these with?" — instead of silently
 * defaulting or blocking, and to fold the user's answer back into the action.
 */

/** One input an action needs, joined from its world declaration. */
export interface Slot {
  key: string;
  prompt: string;
  source: 'selection' | 'payload';
  /** Selection slots: how many objects satisfy it (default 1). */
  min?: number;
  /** Optional slots never block a proposal or trigger a clarification. */
  optional?: boolean;
}

/**
 * Resolve a slot's effective value from the situation, or `null` when it
 * genuinely can't be determined (→ the slot is "missing" and the assistant
 * should ask). `request` is the free text to mine (the original request, or —
 * when folding an answer — the user's reply naming the value).
 */
export type SlotResolver = (
  ctx: ContextBundle,
  ids: string[],
  payload: ActionPayload,
  request: string,
) => unknown | null;

function isFilled(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  return v != null;
}

/** The fallback when a capability declares no resolver for a slot. */
function genericResolve(slot: Slot): SlotResolver {
  return (_ctx, ids, payload) => {
    if (slot.source === 'selection') {
      return ids.length >= (slot.min ?? 1) ? ids : null;
    }
    const v = payload[slot.key];
    return isFilled(v) ? v : null;
  };
}

function resolverFor(intent: string, slot: Slot): SlotResolver {
  return capabilityFor(intent).resolvers[slot.key] ?? genericResolve(slot);
}

/** The required slots this action still can't fill from the situation. */
export function missingSlots(
  intent: string,
  ctx: ContextBundle,
  ids: string[],
  payload: ActionPayload,
  request: string,
): Slot[] {
  return capabilityFor(intent).slots.filter((slot) => {
    if (slot.optional) return false;
    return resolverFor(intent, slot)(ctx, ids, payload, request) == null;
  });
}

/**
 * The first action step in a plan with a missing required slot — where the
 * assistant should pause and ask before running the plan. `null` = every step
 * is fully specified and the plan can be previewed as-is.
 */
export function firstPlanGap(
  plan: Plan,
  ctx: ContextBundle,
  request: string,
): { stepIndex: number; slot: Slot } | null {
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (!step.intent) continue;
    const [slot] = missingSlots(
      step.intent,
      ctx,
      step.ids ?? [],
      step.payload ?? {},
      request,
    );
    if (slot) return { stepIndex: i, slot };
  }
  return null;
}

/**
 * Fold a user's free-text answer into an action's payload for one slot. A slot
 * with a resolver re-runs it over the answer (a name → a person id); a plain
 * payload slot takes the answer verbatim. Returns the payload unchanged when a
 * resolver can't make sense of the answer, so the assistant re-asks.
 */
export function absorbAnswer(
  intent: string,
  slot: Slot,
  answer: string,
  ctx: ContextBundle,
  ids: string[],
  payload: ActionPayload,
): ActionPayload {
  const resolver = capabilityFor(intent).resolvers[slot.key];
  if (resolver) {
    // Clear any prior (empty) value so the resolver mines the answer itself.
    const value = resolver(ctx, ids, { ...payload, [slot.key]: undefined }, answer);
    return value == null ? payload : { ...payload, [slot.key]: value };
  }
  return { ...payload, [slot.key]: answer.trim() };
}
