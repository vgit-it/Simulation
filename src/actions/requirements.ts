import type { ContextBundle } from '../context';
import type { Plan, Supervision } from '../plans/types';
import { capabilityFor, type ActionPayload } from './capabilities';

/**
 * Slot-filling, confidence-ranked: once an intent is known, what inputs does it
 * still need — and how sure are we about the value we'd use?
 *
 * An action's requirements are its `slots` — either the operand SELECTION
 * (which photos, which people) or a free-form PAYLOAD value (recipients,
 * message text, a reminder title). A slot is declared in the app's world file
 * (`world/apps/*.md` — the WHAT + the question to ask), and RESOLVED in code
 * (the HOW — a capability supplies a resolver for slots with a smart default;
 * the rest fall back to a generic "is this value present" check).
 *
 * Resolution is a **confidence-ranked pipeline, not a presence check**: a
 * resolver returns a `Candidate { value, confidence, source }` (or `null` when
 * it genuinely can't determine one). The confidence is compared to a
 * **threshold derived from the supervision level** and lands the slot in one of
 * three bands:
 *  - **ok**     — confidence ≥ threshold → bind silently, no interaction.
 *  - **confirm** — a value exists but below threshold → surface it pre-filled
 *    for a one-tap confirm (the medium band).
 *  - **elicit** — no candidate at all → ask the user outright.
 *
 * This is what turns "share this" (with only a low-confidence default for who to
 * send to) into "Share with Sam?" (pre-filled) instead of silently sending to
 * everyone tagged — and "share this" on a 5-person photo with no name into an
 * open "Who should I share these with?".
 */

/** How sure a resolver is about the value it produced. */
export type Confidence = 'high' | 'medium' | 'low';

/** Where a candidate value came from (for telemetry / debugging). */
export type CandidateSource =
  | 'payload'
  | 'request'
  | 'selection'
  | 'default'
  | 'answer';

/** A resolved input value with the confidence and provenance behind it. */
export interface Candidate {
  value: unknown;
  confidence: Confidence;
  source: CandidateSource;
}

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
 * Resolve a slot's best candidate from the situation, or `null` when it
 * genuinely can't be determined (→ the slot is "elicit" and the assistant asks
 * from scratch). `request` is the free text to mine (the original request, or —
 * when folding an answer — the user's reply naming the value). Each rung of a
 * resolver stamps its own confidence: an explicit payload / a named person is
 * `high`; a "sensible default" (everyone tagged in the photo) is `medium`.
 */
export type SlotResolver = (
  ctx: ContextBundle,
  ids: string[],
  payload: ActionPayload,
  request: string,
) => Candidate | null;

/** Terse constructor for a Candidate — keeps resolvers readable. */
export function candidate(
  value: unknown,
  confidence: Confidence,
  source: CandidateSource,
): Candidate {
  return { value, confidence, source };
}

function isFilled(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  return v != null;
}

/**
 * The fallback when a capability declares no resolver for a slot: a present
 * payload value, or (for the operand) the step's own ids falling back to the
 * LIVE selection, are all treated as `high` — the user picked them explicitly.
 */
function genericResolve(slot: Slot): SlotResolver {
  return (ctx, ids, payload) => {
    if (slot.source === 'selection') {
      if (ids.length >= (slot.min ?? 1)) return candidate(ids, 'high', 'selection');
      // A decider (an LLM especially) may leave a step's own ids empty when it
      // treats the operand as "already covered by the user's selection" (see
      // buildTools' requirement text in src/intelligence/llm/prompt.ts) rather
      // than restating it — fall back to the LIVE selection so the assistant
      // never asks for something the user has visibly already picked.
      const sel = ctx.situation.selection;
      if (sel && sel.kind === slot.key && sel.ids.length >= (slot.min ?? 1)) {
        return candidate(sel.ids, 'high', 'selection');
      }
      return null;
    }
    const v = payload[slot.key];
    return isFilled(v) ? candidate(v, 'high', 'payload') : null;
  };
}

function resolverFor(intent: string, slot: Slot): SlotResolver {
  return capabilityFor(intent).resolvers[slot.key] ?? genericResolve(slot);
}

/**
 * The supervision level chosen for a run doubles as the **confidence threshold**
 * — how sure an inference must be before the task binds it without asking:
 *  - `auto`         → act on `medium` guesses (low bar).
 *  - `confirm-once` → bind `high`; `medium` gets a one-tap confirm.
 *  - `confirm-each` → even a confident guess gets a confirm (nothing silent).
 */
export function meetsThreshold(
  confidence: Confidence,
  supervision: Supervision,
): boolean {
  if (supervision === 'confirm-each') return false;
  if (supervision === 'auto') return confidence !== 'low';
  return confidence === 'high'; // confirm-once
}

/**
 * The clarify pass runs BEFORE the user picks a per-plan supervision level at
 * the PlanSheet, so it needs a default threshold. `confirm-once` keeps the
 * medium band live (a low-confidence default is confirmed, not silently sent)
 * while still binding confident inferences. (Letting the user pick supervision
 * before clarify — so the threshold is truly one dial — is an open thread.)
 */
export const DEFAULT_SUPERVISION: Supervision = 'confirm-once';

/** Which band a slot's resolution lands in for a given supervision level. */
export type SlotBand = 'ok' | 'confirm' | 'elicit';

export function bandFor(
  slot: Slot,
  cand: Candidate | null,
  supervision: Supervision,
): SlotBand {
  if (slot.optional) return 'ok';
  if (!cand) return 'elicit';
  return meetsThreshold(cand.confidence, supervision) ? 'ok' : 'confirm';
}

/**
 * The required slots this action can't bind silently — either needing a
 * pre-filled confirm (medium) or a from-scratch elicit (no candidate) — at the
 * given supervision threshold.
 */
export function missingSlots(
  intent: string,
  ctx: ContextBundle,
  ids: string[],
  payload: ActionPayload,
  request: string,
  supervision: Supervision = DEFAULT_SUPERVISION,
): Slot[] {
  return capabilityFor(intent).slots.filter((slot) => {
    const cand = resolverFor(intent, slot)(ctx, ids, payload, request);
    return bandFor(slot, cand, supervision) !== 'ok';
  });
}

/**
 * A point in a plan where an action step needs the user before it can run: the
 * step, the slot, the pre-filled `candidate` (present for a `confirm`, `null`
 * for an `elicit`), and the band. `firstPlanGap` returns the earliest one.
 */
export interface PlanGap {
  stepIndex: number;
  slot: Slot;
  candidate: Candidate | null;
  band: Exclude<SlotBand, 'ok'>;
}

/**
 * The first action step in a plan with a slot that can't bind silently — where
 * the assistant should pause (to confirm a pre-filled value, or to ask outright)
 * before running the plan. `null` = every step is satisfied and the plan can be
 * previewed as-is.
 */
export function firstPlanGap(
  plan: Plan,
  ctx: ContextBundle,
  request: string,
  supervision: Supervision = DEFAULT_SUPERVISION,
): PlanGap | null {
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (!step.intent) continue;
    for (const slot of capabilityFor(step.intent).slots) {
      const cand = resolverFor(step.intent, slot)(
        ctx,
        step.ids ?? [],
        step.payload ?? {},
        request,
      );
      const band = bandFor(slot, cand, supervision);
      if (band !== 'ok') return { stepIndex: i, slot, candidate: cand, band };
    }
  }
  return null;
}

/**
 * Bind whatever slot values resolve at **high** confidence back onto a plan's
 * steps, so a decider that didn't restate an already-satisfied input (e.g. an
 * LLM step that left `ids` empty, trusting "the operand is already covered by
 * the selection") still ends up with a step carrying the right ids/payload
 * before it's previewed or run. Only `high`-confidence values bind silently —
 * a `medium` default (e.g. "everyone tagged") is deliberately LEFT for the
 * confirm gap, so it's surfaced pre-filled rather than committed unseen. A
 * step's own explicit ids/payload always win (their resolver returns `high`
 * for the value already present), so this is a no-op for an already-correct
 * step (the mock's own plans).
 */
export function resolvePlanSlots(
  plan: Plan,
  ctx: ContextBundle,
  request: string,
): Plan {
  let planChanged = false;
  const steps = plan.steps.map((step) => {
    if (!step.intent) return step;
    let ids = step.ids ?? [];
    let payload = step.payload ?? {};
    let stepChanged = false;
    for (const slot of capabilityFor(step.intent).slots) {
      const cand = resolverFor(step.intent, slot)(ctx, ids, payload, request);
      if (!cand || cand.confidence !== 'high') continue; // only bind confidently
      if (slot.source === 'selection') {
        const resolved = cand.value as string[];
        if (resolved.length !== ids.length || resolved.some((id, i) => id !== ids[i])) {
          ids = resolved;
          stepChanged = true;
        }
      } else if (payload[slot.key] !== cand.value) {
        payload = { ...payload, [slot.key]: cand.value };
        stepChanged = true;
      }
    }
    if (!stepChanged) return step;
    planChanged = true;
    return { ...step, ids, payload };
  });
  return planChanged ? { ...plan, steps } : plan;
}

/**
 * Accept a `confirm`-band gap's pre-filled candidate — the user tapped the
 * confirm chip rather than typing an override. Binds the candidate's value onto
 * the gap's step (an operand → `ids`, a payload slot → `payload[key]`), so a
 * re-check sees it as an explicit, high-confidence input and stops asking.
 */
export function acceptGap(plan: Plan, gap: PlanGap): Plan {
  if (!gap.candidate) return plan;
  const step = plan.steps[gap.stepIndex];
  const bound =
    gap.slot.source === 'selection'
      ? { ...step, ids: gap.candidate.value as string[] }
      : {
          ...step,
          payload: { ...(step.payload ?? {}), [gap.slot.key]: gap.candidate.value },
        };
  return {
    ...plan,
    steps: plan.steps.map((s, i) => (i === gap.stepIndex ? bound : s)),
  };
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
    const cand = resolver(ctx, ids, { ...payload, [slot.key]: undefined }, answer);
    return cand == null ? payload : { ...payload, [slot.key]: cand.value };
  }
  return { ...payload, [slot.key]: answer.trim() };
}
