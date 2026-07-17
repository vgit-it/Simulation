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
 * The POV: which person the viewer embodies and which of that person's devices
 * they're looking at. M1.5 optimizes for a single "hero" (HERO_PERSON_ID) with a
 * switcher across that person's own devices; switching person is deferred.
 */
export interface Session {
  personId: string;
  deviceId: string;
}

interface SessionValue {
  session: Session;
  /** Switch to another device belonging to the current person. */
  setDevice: (deviceId: string) => void;
  /** Embody a different person, landing on their first device. */
  setPerson: (personId: string) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({
    personId: HERO_PERSON_ID,
    deviceId: HERO_DEVICE_ID,
  });

  const setDevice = useCallback((deviceId: string) => {
    setSession((s) => ({ ...s, deviceId }));
  }, []);

  const setPerson = useCallback((personId: string) => {
    const device = getPerson(personId).devices[0];
    if (!device) throw new Error(`Person "${personId}" has no device to embody`);
    setSession({ personId, deviceId: device.id });
  }, []);

  const value = useMemo(
    () => ({ session, setDevice, setPerson }),
    [session, setDevice, setPerson],
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
