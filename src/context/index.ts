import { intelligenceFor, type PersonIntelligence } from '../intelligence';
import type { Session } from '../session';
import type { RuntimeState } from '../state';
import { getDevice, getPerson, type Device, type LoadedPerson } from '../world';

/** What the viewer is currently focused on (fed to the decider). */
export interface Situation {
  app?: string;
  photoIds?: string[];
}

/**
 * The structured "context I collect from the world" that a decider consumes.
 * Assembled deterministically now; this is exactly the bundle an LLM decider
 * would receive later, so mock -> LLM is a swap at the provider, not here.
 */
export interface ContextBundle {
  session: Session;
  now: Date;
  owner: LoadedPerson;
  device: Device;
  brain: PersonIntelligence;
  state: RuntimeState;
  situation: Situation;
}

export function assembleContext(
  session: Session,
  state: RuntimeState,
  situation: Situation = {},
): ContextBundle {
  return {
    session,
    now: new Date(state.clock),
    owner: getPerson(session.personId),
    device: getDevice(session.personId, session.deviceId),
    brain: intelligenceFor(session.personId),
    state,
    situation,
  };
}
