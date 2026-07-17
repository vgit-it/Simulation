import { capabilityFor, type Proposal } from '../actions';
import { assembleContext } from '../context';
import type { Screen } from '../phone/Phone';
import type { Session } from '../session';
import type { RuntimeState, SimEvent } from '../state';
import type { PlanStep } from './types';

/**
 * The shared step-resolution primitives. Both an authored scenario
 * (`scenarios/runner.ts`) and a runtime plan turn "one step" into the same
 * shape — events to dispatch, where to focus the POV, which screen to show —
 * and both build any effect through the one `propose`/`commit` capability path.
 * A plan step differs only in that an *action* step surfaces its `Proposal` for
 * the user to approve rather than auto-committing it (the whole point of a
 * plan: you watch and confirm), so `StepResult` carries an optional proposal.
 */
export interface StepResult {
  /** Events to dispatch immediately (e.g. AppOpened, ClockSet). */
  events: SimEvent[];
  /** Whose phone to look at (and optionally which device). */
  focus?: { personId: string; deviceId?: string };
  /** Which screen to show. */
  screen?: Screen;
  /**
   * An action's proposal, surfaced for approval. Present only for steps that
   * act; the caller commits it (dispatching its events) when the user confirms.
   */
  proposal?: Proposal;
}

/** Turn a focus target ('locked'/'home'/{app}) into a concrete Screen. */
export function focusScreen(screen: 'locked' | 'home' | { app: string }): Screen {
  if (screen === 'locked') return { kind: 'locked' };
  if (screen === 'home') return { kind: 'home' };
  return { kind: 'app', appId: screen.app };
}

/** The event marking a person opening an app (shared by scenarios + plans). */
export function appOpenedEvent(
  personId: string,
  appId: string,
  at: number,
): SimEvent {
  return { type: 'AppOpened', at, person: personId, appId };
}

/**
 * Resolve one plan step for the embodied session. Pure — no dispatch, no
 * commit. A navigate/gather step just opens its app; an action step also builds
 * (but does not commit) its `Proposal` via the capability registry.
 */
export function resolvePlanStep(
  step: PlanStep,
  session: Session,
  state: RuntimeState,
): StepResult {
  const screen: Screen = { kind: 'app', appId: step.app };
  const focus = { personId: session.personId, deviceId: session.deviceId };
  const events = [appOpenedEvent(session.personId, step.app, state.clock)];

  if (!step.intent) return { events, focus, screen };

  const ctx = assembleContext(session, state, { app: step.app });
  const proposal = capabilityFor(step.intent).propose(ctx, step.ids ?? []);
  return { events, focus, screen, proposal };
}
