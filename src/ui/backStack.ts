/**
 * Pure back-press dispatcher, modelled on Android's OnBackPressedDispatcher:
 * any part of the UI that can be "backed out of" registers a handler at a
 * LAYER (how deep it sits in the visual stack); a Back press always runs the
 * highest-layer active handler, ties broken by most recently registered.
 * Priority is explicit rather than derived from mount order because React
 * effects fire child-first, which would invert a naive LIFO stack.
 */
export const LAYER = {
  /** Sheet / ProposalSheet / PlanSheet / the assistant surface. */
  overlay: 40,
  /** The pull-down notification shade. */
  shade: 30,
  /** An in-app sub-view: photo/thread/strand/chat detail, a lightbox. */
  subview: 20,
  /** Photos' multi-select mode (the contextual action bar). */
  mode: 10,
  /** The phone's own app -> home fallback. */
  screen: 0,
} as const;

interface Entry {
  layer: number;
  handler: () => void;
  seq: number;
}

export interface BackStack {
  /** Registers `handler` at `layer`; call the returned fn to unregister. */
  register(layer: number, handler: () => void): () => void;
  /** Runs the highest-layer registered handler. Returns whether one ran. */
  dispatch(): boolean;
}

export function createBackStack(): BackStack {
  const entries: Entry[] = [];
  let seq = 0;

  function register(layer: number, handler: () => void): () => void {
    const entry: Entry = { layer, handler, seq: seq++ };
    entries.push(entry);
    return () => {
      const i = entries.indexOf(entry);
      if (i !== -1) entries.splice(i, 1);
    };
  }

  function dispatch(): boolean {
    if (entries.length === 0) return false;
    let top = entries[0];
    for (const e of entries) {
      if (e.layer > top.layer || (e.layer === top.layer && e.seq > top.seq)) {
        top = e;
      }
    }
    top.handler();
    return true;
  }

  return { register, dispatch };
}
