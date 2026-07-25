import { useCallback, useState } from 'react';
import { assembleContext } from '../context';
import { intelligenceFor } from '../intelligence';
import { useSession } from '../session';
import { useStore } from '../state';
import { strandsFor } from './index';

export interface ConsolidateControl {
  /** Fire-and-forget: asks the brain to re-file the log into threads. */
  run: () => void;
  running: boolean;
  /** The brain's one-line account of what changed (null until a run lands). */
  lastReply: string | null;
}

/**
 * The Consolidate control, shared by every surface that offers it (the Threads
 * app header and the Assistant app header). Owns the async brain call and the
 * single `StrandsConsolidated` dispatch, so a call site is one line.
 *
 * Like `Assistant.onChatSubmit`, a thrown provider error (a bad Gemini key, a
 * dropped network) becomes a calm message rather than a crash — and because
 * the failing providers return the CURRENT set unchanged, a failed run leaves
 * the user's threads exactly as they were.
 */
export function useConsolidate(): ConsolidateControl {
  const { session } = useSession();
  const { state, dispatch } = useStore();
  const [running, setRunning] = useState(false);
  const [lastReply, setLastReply] = useState<string | null>(null);

  const run = useCallback(() => {
    if (running) return;
    const person = session.personId;
    const current = strandsFor(state, person);
    const ctx = assembleContext(session, state, { app: 'threads' });
    setRunning(true);
    void (async () => {
      try {
        const result = await intelligenceFor(person).consolidate(ctx, current);
        // Count what actually landed, so the event's telemetry reflects the
        // merge rather than what the brain claimed.
        const before = new Set(
          current.flatMap((s) => s.items.map((i) => i.source)),
        );
        const sources = result.strands
          .flatMap((s) => s.items)
          .filter((i) => !before.has(i.source)).length;
        if (sources > 0 || result.strands.length !== current.length) {
          dispatch({
            type: 'StrandsConsolidated',
            at: state.clock,
            person,
            strands: result.strands,
            sources,
          });
        }
        setLastReply(result.reply);
      } catch (err) {
        setLastReply(
          `Couldn't consolidate right now. ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      } finally {
        setRunning(false);
      }
    })();
  }, [dispatch, running, session, state]);

  return { run, running, lastReply };
}
