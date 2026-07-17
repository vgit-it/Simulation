import { useCallback, useEffect, useRef, useState } from 'react';
import { type Proposal } from '../actions';
import { useScreenControl } from '../phone/screen';
import { useSession } from '../session';
import { useStore } from '../state';
import { resolvePlanStep } from './executor';
import type { Plan } from './types';

/** How long a navigate/gather step lingers before the plan advances itself. */
const NAV_BEAT_MS = 1400;

export interface ActivePlan {
  plan: Plan;
  stepIndex: number;
  /** The current action step's proposal, awaiting approval (null on nav steps). */
  proposal: Proposal | null;
}

export interface PlanRunner {
  active: ActivePlan | null;
  /** Begin executing a plan (records PlanStarted, drives the phone). */
  start: (plan: Plan) => void;
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

  const start = useCallback(
    (plan: Plan) => {
      dispatch({
        type: 'PlanStarted',
        at: stateRef.current.clock,
        person: sessionRef.current.personId,
        planId: plan.id,
        goal: plan.goal,
        steps: plan.steps.length,
      });
      setActive({ plan, stepIndex: 0, proposal: null });
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
    setActive((a) =>
      a ? { ...a, proposal: null, stepIndex: a.stepIndex + 1 } : null,
    );
  }, []);

  useEffect(() => {
    if (!active || active.proposal) return; // idle, or paused on approval

    const { plan, stepIndex } = active;
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
    const result = resolvePlanStep(step, sessionRef.current, stateRef.current);
    if (result.focus) {
      setPerson(result.focus.personId);
      if (result.focus.deviceId) setDevice(result.focus.deviceId);
    }
    if (result.screen) setScreen(result.screen);
    result.events.forEach(dispatch);

    if (result.proposal) {
      const proposal = result.proposal;
      setActive((a) => (a ? { ...a, proposal } : null));
      return;
    }
    // Navigate/gather step: linger, then advance.
    const id = setTimeout(() => {
      setActive((a) => (a ? { ...a, stepIndex: a.stepIndex + 1 } : null));
    }, NAV_BEAT_MS);
    return () => clearTimeout(id);
    // Keyed on the step pointer only — see the doc comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.plan.id, active?.stepIndex, active?.proposal]);

  return { active, start, cancel, onProposalSent };
}
