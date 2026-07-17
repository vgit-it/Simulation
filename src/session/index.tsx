import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { HERO_DEVICE_ID, HERO_PERSON_ID } from '../config';
import { getPerson } from '../world';

/**
 * Objects the viewer currently has selected on screen — the bridge between a
 * direct manipulation ("tap three photos") and an assistant command ("share
 * *these*"). Apps write it while the user picks; the assistant reads it via
 * `assembleContext`, which folds it into the ContextBundle's Situation.
 */
export interface Selection {
  /** The app the selected objects live in (e.g. 'photos'). */
  app: string;
  /** What kind of objects are selected (e.g. 'photos') — capability matching key. */
  kind: string;
  ids: string[];
}

/**
 * The POV: which person the viewer embodies and which of that person's devices
 * they're looking at, plus what (if anything) they have selected on screen.
 * `selection` is optional so plain `{ personId, deviceId }` literals (scenario
 * steps, tests) remain valid sessions.
 */
export interface Session {
  personId: string;
  deviceId: string;
  selection?: Selection | null;
}

interface SessionValue {
  session: Session;
  /** Switch to another device belonging to the current person. */
  setDevice: (deviceId: string) => void;
  /** Embody a different person, landing on their first device. */
  setPerson: (personId: string) => void;
  /** Replace the current on-screen selection (null clears it). */
  setSelection: (selection: Selection | null) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({
    personId: HERO_PERSON_ID,
    deviceId: HERO_DEVICE_ID,
    selection: null,
  });

  // Switching device or person drops the selection — it referred to what was
  // on the previous screen.
  const setDevice = useCallback((deviceId: string) => {
    setSession((s) => ({ ...s, deviceId, selection: null }));
  }, []);

  const setPerson = useCallback((personId: string) => {
    const device = getPerson(personId).devices[0];
    if (!device) throw new Error(`Person "${personId}" has no device to embody`);
    setSession({ personId, deviceId: device.id, selection: null });
  }, []);

  const setSelection = useCallback((selection: Selection | null) => {
    setSession((s) => ({ ...s, selection }));
  }, []);

  const value = useMemo(
    () => ({ session, setDevice, setPerson, setSelection }),
    [session, setDevice, setPerson, setSelection],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}

/** The devices the current hero can switch between. */
export function useHeroDevices() {
  const { session } = useSession();
  return getPerson(session.personId).devices;
}
