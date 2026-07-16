import type { SimEvent } from './events';

/**
 * Persists the event log to localStorage. Because the log is the source of
 * truth, this is the entire persistence story for the static-hosted prototype.
 * Bump the key's version suffix if the event shape changes incompatibly.
 */
const STORAGE_KEY = 'sim.eventlog.v1';

export function loadLog(): SimEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SimEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveLog(log: SimEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // Ignore (private mode / quota); the world simply won't persist.
  }
}

export function clearLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
