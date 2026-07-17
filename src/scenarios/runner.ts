import { propose } from '../actions';
import { assembleContext } from '../context';
import {
  appOpenedEvent,
  focusScreen,
  type StepResult,
} from '../plans/executor';
import { getPerson, type ScenarioStep } from '../world';
import type { RuntimeState, SimEvent } from '../state';

export type { StepResult };

/**
 * Resolve one scenario step against the current runtime state. Pure — no
 * dispatch. Shares its step-resolution primitives (`focusScreen`,
 * `appOpenedEvent`, the `propose` capability path) with runtime plans, so a
 * scripted step and a planned step take the exact same road to an effect.
 * Scenario `share` steps auto-commit (they inline the proposal's events),
 * whereas a plan's action step surfaces the proposal for approval.
 */
export function resolveStep(step: ScenarioStep, state: RuntimeState): StepResult {
  switch (step.kind) {
    case 'clock':
      return {
        events: [{ type: 'ClockSet', at: state.clock, to: step.at.getTime() }],
      };

    case 'focus': {
      const screen = focusScreen(step.screen);
      const events: SimEvent[] =
        screen.kind === 'app'
          ? [appOpenedEvent(step.person, screen.appId, state.clock)]
          : [];
      return {
        events,
        focus: { personId: step.person, deviceId: step.device },
        screen,
      };
    }

    case 'share': {
      const owner = getPerson(step.person);
      const deviceId = step.device ?? owner.devices[0].id;
      const session = { personId: step.person, deviceId };
      const ctx = assembleContext(session, state, {
        app: 'photos',
        photoIds: step.photos,
      });
      const proposal = propose('share-photos', ctx, step.photos);
      return {
        events: proposal.events,
        focus: session,
        screen: { kind: 'app', appId: 'photos' },
      };
    }
  }
}
