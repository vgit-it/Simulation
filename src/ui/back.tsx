import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { createBackStack, type BackStack } from './backStack';

/**
 * Shares one back-press stack for the whole phone (mounted in the Stage,
 * alongside ScreenProvider) so any overlay or in-app sub-view — wherever it
 * lives in the tree — can register itself as "what Back should do right now".
 */
const BackContext = createContext<BackStack | null>(null);

export function BackProvider({ children }: { children: ReactNode }) {
  const stack = useMemo(() => createBackStack(), []);
  return <BackContext.Provider value={stack}>{children}</BackContext.Provider>;
}

function useBackStack(): BackStack {
  const ctx = useContext(BackContext);
  if (!ctx) {
    throw new Error(
      'useBackHandler/useBack must be used within <BackProvider>',
    );
  }
  return ctx;
}

/**
 * Registers `handler` at `layer` while `active` is true. A Back press always
 * runs the highest-layer active handler (see `LAYER` in backStack.ts) — e.g. a
 * photo detail view (subview) beats the app-closes-to-home fallback (screen)
 * without either side needing to know about the other.
 */
export function useBackHandler(
  active: boolean,
  handler: () => void,
  layer: number,
): void {
  const stack = useBackStack();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!active) return;
    return stack.register(layer, () => handlerRef.current());
  }, [active, layer, stack]);
}

/** For the thing that actually sends a Back press — the nav bar. */
export function useBack(): { back: () => boolean } {
  const stack = useBackStack();
  return useMemo(() => ({ back: () => stack.dispatch() }), [stack]);
}
