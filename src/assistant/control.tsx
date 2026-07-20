import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSession } from '../session';
import { uid } from '../state';

/**
 * Shared control over the assistant sheet, so it can be summoned from
 * anywhere on the phone — holding the nav bar's home button or a conversation
 * row in the Assistant app — the same way ScreenProvider shares the lifted
 * screen.
 *
 * The one rule it encodes: invoking the assistant from anywhere OTHER than an
 * existing thread starts a FRESH conversation. `open()` with no argument
 * mints a new session id (the home-button path); `open(sessionId)` resumes that
 * thread (the Assistant app path). An unused fresh id leaves no trace — a
 * thread only exists once a ChatMessage event carries its id.
 */
export interface AssistantControl {
  /** The open sheet's conversation thread, or null when the sheet is closed. */
  sessionId: string | null;
  /** Open the sheet: on a fresh conversation (no arg) or an existing thread. */
  open: (sessionId?: string) => void;
  close: () => void;
}

const AssistantControlContext = createContext<AssistantControl | null>(null);

export function AssistantControlProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [sessionId, setSessionId] = useState<string | null>(null);

  const open = useCallback(
    (id?: string) => setSessionId(id ?? uid('chat')),
    [],
  );
  const close = useCallback(() => setSessionId(null), []);

  // Switching POV is picking up a different phone — any open sheet closes.
  useEffect(() => {
    setSessionId(null);
  }, [session.personId]);

  const value = useMemo(
    () => ({ sessionId, open, close }),
    [sessionId, open, close],
  );
  return (
    <AssistantControlContext.Provider value={value}>
      {children}
    </AssistantControlContext.Provider>
  );
}

export function useAssistantControl(): AssistantControl {
  const ctx = useContext(AssistantControlContext);
  if (!ctx) {
    throw new Error(
      'useAssistantControl must be used within <AssistantControlProvider>',
    );
  }
  return ctx;
}
