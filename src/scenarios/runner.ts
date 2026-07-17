import { propose } from '../actions';
import { assembleContext } from '../context';
import type { Screen } from '../phone/Phone';
import { getPerson, type ScenarioStep } from '../world';
import type { RuntimeState, SimEvent } from '../state';

/** What playing one scenario step produces: events to dispatch, and where to look. */
export interface StepResult {
  events: SimEvent[];
  focus?: { personId: string; deviceId?: string };
  screen?: Screen;
}

function focusScreen(screen: 'locked' | 'home' | { app: string }): Screen {
  if (screen === 'locked') return { kind: 'locked' };
  if (screen === 'home') return { kind: 'home' };
  return { kind: 'app', appId: screen.app };
}

/** Resolve one scenario step against the current runtime state. Pure — no dispatch. */
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
          ? [
              {
                type: 'AppOpened',
                at: state.clock,
                person: step.person,
                appId: screen.appId,
              },
            ]
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
      const photos = owner.gallery.filter((p) => step.photos.includes(p.id));
      const ctx = assembleContext(session, state, {
        app: 'photos',
        photoIds: photos.map((p) => p.id),
      });
      const proposal = propose('share-photos', ctx, photos);
      return {
        events: proposal.events,
        focus: session,
        screen: { kind: 'app', appId: 'photos' },
      };
    }
  }
}
