import type { SimEvent } from './events';
import type { RuntimeState } from './reducer';

/**
 * The research-instrumentation overlay: a parallel record of WHEN (wall clock)
 * and at what interaction cost (cumulative in-phone taps) each sim event
 * landed. The sim event log stays purely deterministic — sim-clocked, no
 * `Date.now()` — while this trace rides beside it, one entry per dispatched
 * event, aligned by order. Nothing in sim behavior ever reads the trace; it
 * exists only for the session export, where an analyst can compute
 * taps/seconds between any two log points (e.g. manual-path vs assistant-path
 * for the same task).
 *
 * This is the ONE module where wall-clock time is allowed: it measures the
 * human, not the sim (principle 5 governs sim behavior only).
 */
export interface TraceEntry {
  /** Index into the trace (matches the event's position in the log). */
  seq: number;
  /** The sim event's type, for matching entries to log events. */
  type: string;
  /** The sim clock when the event was dispatched. */
  simAt: number;
  /** Wall-clock ms when the event was dispatched. */
  wallAt: number;
  /** Cumulative in-phone taps at that moment. */
  taps: number;
}

const TRACE_KEY = 'sim.trace.v1';
const TAPS_KEY = 'sim.taps.v1';

let entries: TraceEntry[] = load(TRACE_KEY, []);
let taps: number = load(TAPS_KEY, 0);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(): void {
  try {
    localStorage.setItem(TRACE_KEY, JSON.stringify(entries));
    localStorage.setItem(TAPS_KEY, JSON.stringify(taps));
  } catch {
    // Ignore (private mode / quota); the sim works fine without its trace.
  }
}

/** Count one physical interaction with the phone (capture-phase pointerdown). */
export function countTap(): void {
  taps += 1;
  save();
}

/** Record the trace entry for a just-dispatched sim event. */
export function traceEvent(event: SimEvent): void {
  entries = [
    ...entries,
    {
      seq: entries.length,
      type: event.type,
      simAt: event.at,
      wallAt: Date.now(),
      taps,
    },
  ];
  save();
}

/** Wipe the trace (paired with the store's world reset). */
export function clearTrace(): void {
  entries = [];
  taps = 0;
  save();
}

export function getTrace(): TraceEntry[] {
  return entries;
}

export function getTapCount(): number {
  return taps;
}

/** Everything a study session produced, as one downloadable JSON document. */
export interface SessionExport {
  version: 1;
  /** Wall-clock export moment (ISO). */
  exportedAt: string;
  /** The sim clock at export. */
  simClock: number;
  /** Which brain produced the assistant's behavior during the session. */
  provider: string;
  /** Total in-phone taps over the session. */
  taps: number;
  /** The full sim event log (what happened, sim-clocked). */
  events: SimEvent[];
  /** The instrumentation overlay (when it happened, at what tap cost). */
  trace: TraceEntry[];
}

/** Assemble the session export from the current state + trace. */
export function buildSessionExport(
  state: RuntimeState,
  provider: string,
): SessionExport {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    simClock: state.clock,
    provider,
    taps,
    events: state.log,
    trace: entries,
  };
}
