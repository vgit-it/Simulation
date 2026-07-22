import type { Candidate, Slot } from '../actions';
import type { Plan } from '../plans/types';

/**
 * The Task System's interpreter vocabulary (see TASK_SYSTEM.md, "The task
 * stack"). The doc's four task kinds map to the engine as:
 *  - **Effect** (leaf, world-changing) = a capability's `propose`/`commit`
 *    (`src/actions/`) — already exists.
 *  - **Query** (leaf, derives a value) = the brain's methods / selectors — exists.
 *  - **Elicit** (leaf, interactive) = an `ElicitFrame` here.
 *  - **Composite** (an arrangement of sub-tasks) = "resolve a plan's inputs",
 *    driven here by the stack of frames below.
 *
 * This module implements the **Elicit + Composite** piece — input resolution as
 * a real suspend/resume STACK, generalizing the assistant's former depth-1
 * `pending`. Execution of a resolved plan still runs through `usePlanRunner`
 * (the Effect leaves); folding that + scenarios + autopilot onto this one
 * interpreter is the remaining Stage-3 follow-up.
 */

/** A suspended "ask the user for one slot value" (the current question). */
export interface ElicitFrame {
  kind: 'elicit';
  /** The plan step whose input this resolves. */
  stepIndex: number;
  slot: Slot;
  /** What the assistant says when this frame is on top. */
  prompt: string;
  /** `confirm` = a pre-filled candidate (one-tap); `elicit` = ask outright. */
  band: 'confirm' | 'elicit';
  /** The pre-filled candidate for a `confirm` band (else null). */
  candidate?: Candidate | null;
}

/**
 * A disambiguation pushed OVER an elicit when its answer was ambiguous ("j" →
 * Jamie? Jordan?). Picking one resumes the elicit beneath it. This is the
 * suspend/resume nesting the stack exists for — depth ≤2 with today's content,
 * N-deep by construction.
 */
export interface ChoiceFrame {
  kind: 'choice';
  stepIndex: number;
  slot: Slot;
  prompt: string;
  alternatives: Candidate[];
}

export type Frame = ElicitFrame | ChoiceFrame;

/** The interpreter's resumable state: a plan being resolved + the ask stack. */
export interface ResolveState {
  plan: Plan;
  request: string;
  /** The suspend/resume stack; the last entry is the current ask (top). */
  frames: Frame[];
}

/** The frame the UI renders — the top of the stack. */
export type Ask = Frame;

/** Run/resume outcome: the plan is fully specified, or a question is pending. */
export type ResolveResult =
  | { status: 'done'; plan: Plan }
  | { status: 'resolving'; state: ResolveState; ask: Ask };
