import {
  DEFAULT_SUPERVISION,
  bindGapValue,
  firstPlanGap,
  resolvePlanSlots,
  type Candidate,
  type PlanGap,
} from '../actions';
import type { ContextBundle } from '../context';
import type { Plan, Supervision } from '../plans/types';
import type { ChoiceFrame, ElicitFrame, ResolveResult, ResolveState } from './types';

/**
 * The input-resolution interpreter: a pure suspend/resume stack over a plan's
 * gaps, reusing the Stage-1/2 primitives (`resolvePlanSlots`, `firstPlanGap`,
 * `bindGapValue`). It replaces the assistant's former inline depth-1 clarify
 * loop; the assistant is now a thin consumer that renders the current ask and
 * feeds answers back.
 *
 * Parsing (turning a typed answer into candidates) stays OUTSIDE the interpreter
 * — in `valueKinds.parseSlotAnswer`, which touches the world — so this module is
 * pure over already-produced candidates and fully unit-testable. The caller
 * handles the empty (`[]`, "I didn't catch that") case before calling
 * `answerResolve`.
 */

function elicitFrame(gap: PlanGap): ElicitFrame {
  return {
    kind: 'elicit',
    stepIndex: gap.stepIndex,
    slot: gap.slot,
    prompt: gap.slot.prompt,
    band: gap.band,
    candidate: gap.candidate,
  };
}

/**
 * Bind the confident values, find the next gap, and rebuild the ask stack: a
 * fresh single elicit for that gap, or `done`. Resolving any frame collapses the
 * stack back to this — so popping the top elicit AND a disambiguation child both
 * fall out of recomputing from the (now further-bound) plan.
 */
function advance(
  plan: Plan,
  ctx: ContextBundle,
  request: string,
  supervision: Supervision,
): ResolveResult {
  const resolved = resolvePlanSlots(plan, ctx, request);
  const gap = firstPlanGap(resolved, ctx, request, supervision);
  if (!gap) return { status: 'done', plan: resolved };
  const ask = elicitFrame(gap);
  return { status: 'resolving', state: { plan: resolved, request, frames: [ask] }, ask };
}

/** Begin resolving a plan's inputs: the first gap becomes the first ask. */
export function beginResolve(
  plan: Plan,
  ctx: ContextBundle,
  request: string,
  supervision: Supervision = DEFAULT_SUPERVISION,
): ResolveResult {
  return advance(plan, ctx, request, supervision);
}

/**
 * Resume with the answer to the current ask, as candidate(s):
 *  - **many** → the answer was ambiguous: PUSH a choice frame over the current
 *    elicit and suspend on it (the sub-task).
 *  - **one** → BIND its value to the ask's step/slot and advance to the next gap
 *    (recomputing collapses the stack — popping the elicit and any choice child).
 * `answerResolve` is only called with ≥1 candidate (the caller re-asks on 0).
 */
export function answerResolve(
  state: ResolveState,
  ctx: ContextBundle,
  cands: Candidate[],
  supervision: Supervision = DEFAULT_SUPERVISION,
): ResolveResult {
  const top = state.frames[state.frames.length - 1];
  if (!top) return { status: 'done', plan: state.plan };

  if (cands.length > 1) {
    const choice: ChoiceFrame = {
      kind: 'choice',
      stepIndex: top.stepIndex,
      slot: top.slot,
      prompt: 'Which one did you mean?',
      alternatives: cands,
    };
    return {
      status: 'resolving',
      state: { ...state, frames: [...state.frames, choice] },
      ask: choice,
    };
  }

  const gap: PlanGap = {
    stepIndex: top.stepIndex,
    slot: top.slot,
    candidate: null,
    band: 'elicit',
  };
  const bound = bindGapValue(state.plan, gap, cands[0].value);
  return advance(bound, ctx, state.request, supervision);
}
