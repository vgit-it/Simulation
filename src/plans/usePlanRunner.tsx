import { useCallback, useEffect, useRef, useState } from 'react';
import { commit, type Proposal } from '../actions';
import { useScreenControl } from '../phone/screen';
import { useSession } from '../session';
import { useStore } from '../state';
import { resolvePlanStep } from './executor';
import type { Plan, Supervision } from './types';

/** How long a navigate/gather step lingers before the plan advances itself. */
const NAV_BEAT_MS = 1400;
/** Beat between auto-committed steps in 'auto' mode (state settles between). */
const AUTO_BEAT_MS = 250;

export interface ActivePlan {
  plan: Plan;
  stepIndex: number;
  supervision: Supervision;
  /** The current action step's proposal, awaiting approval (null on nav steps). */
  proposal: Proposal | null;
}

export interface PlanRunner {
  active: ActivePlan | null;
  /**
   * Begin executing a plan (records PlanStarted, drives the phone). `struck`
   * is how many proposed steps the user edited out before running (telemetry).
   */
  start: (plan: Plan, supervision?: Supervision, struck?: number) => void;
  /** Abort the running plan (records PlanCompleted 'cancelled'). */
  cancel: () => void;
  /** Advance past the current action step once its proposal is committed. */
  onProposalSent: () => void;
}

/**
 * Drives a runtime plan through the phone, one step at a time: it focuses the
 * POV, opens each step's app (dispatching AppOpened), and for an action step
 * surfaces the step's Proposal for approval — pausing until the user commits or
 * cancels. Navigate/gather steps auto-advance after a beat so the user can watch
 * the context the next step acts on. It reuses the exact levers a human/DevBar/
 * scenario uses (session POV + the lifted screen), so nothing here is a parallel
 * effect path.
 *
 * The supervision level relaxes the pausing: 'confirm-once' commits action
 * proposals itself while still walking the phone app-by-app; 'auto' commits
 * every step back-to-back without driving the screen at all. An INVALID
 * proposal always pauses, whatever the level — autonomy never overrides a
 * validity stop.
 *
 * State/session are read through refs so the executor sees fresh values without
 * the drive-effect re-firing every time the log changes (which would re-resolve
 * and re-dispatch the same step). The effect keys only on the step pointer.
 */
export function usePlanRunner(): PlanRunner {
  const { session, setPerson, setDevice } = useSession();
  const { state, dispatch } = useStore();
  const { setScreen } = useScreenControl();
  const [active, setActive] = useState<ActivePlan | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const activeRef = useRef(active);
  activeRef.current = active;

  /** Per-step telemetry: record that a plan's current step finished. */
  const recordStepDone = useCallback(
    (a: ActivePlan) => {
      const step = a.plan.steps[a.stepIndex];
      if (!step) return;
      dispatch({
        type: 'PlanStepCompleted',
        at: stateRef.current.clock,
        person: sessionRef.current.personId,
        planId: a.plan.id,
        stepIndex: a.stepIndex,
        label: step.description,
      });
    },
    [dispatch],
  );

  const start = useCallback(
    (plan: Plan, supervision: Supervision = 'confirm-each', struck = 0) => {
      dispatch({
        type: 'PlanStarted',
        at: stateRef.current.clock,
        person: sessionRef.current.personId,
        planId: plan.id,
        goal: plan.goal,
        steps: plan.steps.length,
        supervision,
        struck,
      });
      setActive({ plan, stepIndex: 0, supervision, proposal: null });
    },
    [dispatch],
  );

  const cancel = useCallback(() => {
    setActive((a) => {
      if (a) {
        dispatch({
          type: 'PlanCompleted',
          at: stateRef.current.clock,
          person: sessionRef.current.personId,
          planId: a.plan.id,
          outcome: 'cancelled',
        });
      }
      return null;
    });
  }, [dispatch]);

  const onProposalSent = useCallback(() => {
    if (activeRef.current) recordStepDone(activeRef.current);
    setActive((a) =>
      a ? { ...a, proposal: null, stepIndex: a.stepIndex + 1 } : null,
    );
  }, [recordStepDone]);

  useEffect(() => {
    if (!active || active.proposal) return; // idle, or paused on approval

    const { plan, stepIndex, supervision } = active;
    if (stepIndex >= plan.steps.length) {
      dispatch({
        type: 'PlanCompleted',
        at: stateRef.current.clock,
        person: sessionRef.current.personId,
        planId: plan.id,
        outcome: 'completed',
      });
      setActive(null);
      return;
    }

    const step = plan.steps[stepIndex];
    const auto = supervision === 'auto';

    // 'auto' skips the walkthrough entirely: navigate steps are no-ops and
    // nothing drives the phone screen — only the effects land.
    if (auto && !step.intent) {
      recordStepDone(active);
      setActive((a) => (a ? { ...a, stepIndex: a.stepIndex + 1 } : null));
      return;
    }

    const result = resolvePlanStep(step, sessionRef.current, stateRef.current);
    if (!auto) {
      if (result.focus) {
        setPerson(result.focus.personId);
        if (result.focus.deviceId) setDevice(result.focus.deviceId);
      }
      if (result.screen) setScreen(result.screen);
      result.events.forEach(dispatch);
    }

    if (result.proposal) {
      const proposal = result.proposal;
      // A proposal that can't commit pauses at the sheet whatever the level.
      if (supervision === 'confirm-each' || proposal.invalidReason) {
        setActive((a) => (a ? { ...a, proposal } : null));
        return;
      }
      // Supervised-once / auto: the Run tap was the approval — commit now,
      // then advance after a beat (long enough to watch in 'confirm-once').
      commit(proposal, dispatch);
      const id = setTimeout(() => {
        recordStepDone(active);
        setActive((a) => (a ? { ...a, stepIndex: a.stepIndex + 1 } : null));
      }, auto ? AUTO_BEAT_MS : NAV_BEAT_MS);
      return () => clearTimeout(id);
    }

    // Navigate/gather step: linger, then advance.
    const id = setTimeout(() => {
      recordStepDone(active);
      setActive((a) => (a ? { ...a, stepIndex: a.stepIndex + 1 } : null));
    }, NAV_BEAT_MS);
    return () => clearTimeout(id);
    // Keyed on the step pointer only — see the doc comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.plan.id, active?.stepIndex, active?.proposal]);

  return { active, start, cancel, onProposalSent };
}
