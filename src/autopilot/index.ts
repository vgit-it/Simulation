import { useEffect } from 'react';
import { propose } from '../actions';
import { assembleContext } from '../context';
import { useSession } from '../session';
import { useStore, type RuntimeState, type SimEvent } from '../state';
import { world } from '../world';

/**
 * Resident autopilot: the world acting back. Each resident's authored
 * `behaviors:` (world/people/<id>/profile.md) can include an `auto-reply` —
 * reply to an inbound SHARE after a sim-time delay. This resolver is pure:
 * given the current state, it returns the reply events that are now due.
 *
 * Ground rules:
 * - The embodied person never autopilots — picking up their phone takes over.
 * - Only messages WITH attachments (shares) draw a reply, so two auto-repliers
 *   can't ping-pong text replies at each other forever.
 * - Replies build through the same `send-message` capability a human or plan
 *   uses (no parallel effect path), then are re-stamped to the DUE time — Sam
 *   "replied two hours after the share", not "when the clock jump happened".
 * - A reply at >= the share's timestamp counts as answered (the sim clock may
 *   not move between events), which also makes this resolver idempotent: once
 *   its replies are in the log, nothing further is due.
 */
export function dueAutopilotActions(
  state: RuntimeState,
  embodiedId: string,
): SimEvent[] {
  const events: SimEvent[] = [];

  for (const person of Object.values(world.people)) {
    const me = person.id;
    if (me === embodiedId) continue;
    const behavior = person.behaviors['auto-reply'];
    if (!behavior) continue;
    const device = person.devices[0];
    if (!device || !device.apps.includes('messages')) continue;

    const delayMs = behavior['delay-hours'] * 3_600_000;
    // One reply per sender per pass: answer their newest due share.
    const repliedTo = new Set<string>();

    const dueShares = state.messages
      .filter(
        (m) =>
          m.from !== me &&
          m.to.includes(me) &&
          m.attachments.length > 0 &&
          state.clock >= m.at + delayMs,
      )
      .sort((a, b) => b.at - a.at);

    for (const share of dueShares) {
      if (repliedTo.has(share.from)) continue;
      const answered = state.messages.some(
        (r) =>
          r.from === me && r.at >= share.at && r.to.includes(share.from),
      );
      if (answered) {
        repliedTo.add(share.from);
        continue;
      }
      const session = { personId: me, deviceId: device.id };
      const ctx = assembleContext(session, state, { selection: null });
      const text = behavior.message ?? 'Just saw this — love it! 😊';
      const proposal = propose('send-message', ctx, [share.from], { text });
      const due = share.at + delayMs;
      events.push(...proposal.events.map((e) => ({ ...e, at: due })));
      repliedTo.add(share.from);
    }
  }

  return events;
}

/**
 * Mounts the autopilot on the stage: whenever runtime state changes (a share
 * lands, the clock advances), any now-due resident replies are dispatched.
 * Dispatching them changes state, the effect re-runs, finds nothing due
 * (answered), and settles — the resolver's idempotence is the loop guard.
 */
export function useAutopilot(): void {
  const { session } = useSession();
  const { state, dispatch } = useStore();

  useEffect(() => {
    const due = dueAutopilotActions(state, session.personId);
    due.forEach(dispatch);
  }, [state, session.personId, dispatch]);
}
