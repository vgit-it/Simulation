import { intelligenceFor, type PersonIntelligence } from '../intelligence';
import type { Selection, Session } from '../session';
import type { RuntimeState } from '../state';
import { getDevice, getPerson, type Device, type LoadedPerson } from '../world';

/**
 * What the viewer is currently focused on (fed to the decider). `selection` is
 * the objects the user has picked on screen (folded in automatically from the
 * session by `assembleContext`); `photoIds` names photos a caller is acting on
 * explicitly (e.g. a suggestion's photo set), which need not be a selection.
 */
export interface Situation {
  app?: string;
  photoIds?: string[];
  selection?: Selection | null;
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
  // The session's live selection is part of the situation unless the caller
  // overrides it — "what the user has picked" travels with the context for
  // free, so a decider can bind "share *these*" without callers plumbing ids.
  // An explicit `selection: null` means "pretend nothing is selected".
  const selection =
    situation.selection !== undefined
      ? situation.selection
      : (session.selection ?? null);
  return {
    session,
    now: new Date(state.clock),
    owner: getPerson(session.personId),
    device: getDevice(session.personId, session.deviceId),
    brain: intelligenceFor(session.personId),
    state,
    situation: {
      ...situation,
      selection,
      app: situation.app ?? selection?.app,
    },
  };
}
