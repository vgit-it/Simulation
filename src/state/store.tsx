import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from 'react';
import type { SimEvent } from './events';
import { hydrate, reduce, type RuntimeState } from './reducer';
import { clearLog, loadLog, saveLog } from './persistence';
import { clearTrace, traceEvent } from './trace';

interface StoreValue {
  state: RuntimeState;
  /** Append an event to the log (the only way to mutate the world). */
  dispatch: (event: SimEvent) => void;
  /** Wipe runtime state back to the authored seed. */
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, raw] = useReducer(reduce, undefined, () => hydrate(loadLog()));

  useEffect(() => {
    saveLog(state.log);
  }, [state.log]);

  const dispatch = useCallback((event: SimEvent) => {
    // Instrumentation overlay: stamp wall time + tap count beside the log
    // entry (the sim event itself stays purely sim-clocked).
    traceEvent(event);
    raw({ kind: 'event', event });
  }, []);
  const reset = useCallback(() => {
    clearLog();
    clearTrace();
    raw({ kind: 'reset' });
  }, []);

  return (
    <StoreContext.Provider value={{ state, dispatch, reset }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}

/** Current simulation time (from the store's clock, never the wall clock). */
export function useNow(): Date {
  return new Date(useStore().state.clock);
}
