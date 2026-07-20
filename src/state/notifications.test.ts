import { describe, expect, it } from 'vitest';
import { freshState, reduce, type RuntimeState } from './reducer';
import { notificationCountFor, notificationsFor } from './selectors';
import { inboxThreads } from './selectors';
import type { SimEvent } from './events';

function withEvents(...events: SimEvent[]): RuntimeState {
  return events.reduce(
    (s, event) => reduce(s, { kind: 'event', event }),
    freshState(),
  );
}

const inboundShare: SimEvent = {
  type: 'MessageSent',
  id: 'm1',
  at: 1000,
  from: 'sam-ruiz',
  to: ['ava-chen'],
  body: 'Sent you a photo',
  attachments: ['img-010'],
  intent: 'share-photos',
};

const reminder: SimEvent = {
  type: 'ReminderCreated',
  id: 'r1',
  at: 1500,
  person: 'ava-chen',
  title: 'Print the beach photo',
  related: ['img-010'],
};

describe('notifications', () => {
  it('surfaces an inbound message as a notification (not for the sender)', () => {
    const state = withEvents(inboundShare);
    const ava = notificationsFor(state, 'ava-chen');
    expect(ava).toHaveLength(1);
    expect(ava[0]).toMatchObject({
      kind: 'message',
      appId: 'messages',
      fromId: 'sam-ruiz',
      attachments: 1,
    });
    // The sender sees nothing (their own outgoing message).
    expect(notificationCountFor(state, 'sam-ruiz')).toBe(0);
  });

  it('surfaces a reminder, newest first, alongside a message', () => {
    const state = withEvents(inboundShare, reminder);
    const ava = notificationsFor(state, 'ava-chen');
    expect(ava.map((n) => n.kind)).toEqual(['reminder', 'message']); // 1500 > 1000
    expect(ava[0].appId).toBe('reminders');
  });

  it('reading a thread retires its message notification (shared read model)', () => {
    const state = withEvents(inboundShare);
    const key = inboxThreads(state, 'ava-chen')[0].key;
    const read = reduce(state, {
      kind: 'event',
      event: { type: 'ThreadRead', at: 1000, person: 'ava-chen', thread: key },
    });
    expect(notificationCountFor(read, 'ava-chen')).toBe(0);
  });

  it('Clear all dismisses what is showing; newer events resurface', () => {
    const state = withEvents(inboundShare, reminder);
    expect(notificationCountFor(state, 'ava-chen')).toBe(2);

    // Clear at t=2000 (>= both) hides everything currently showing.
    const cleared = reduce(state, {
      kind: 'event',
      event: { type: 'NotificationsCleared', at: 2000, person: 'ava-chen' },
    });
    expect(notificationCountFor(cleared, 'ava-chen')).toBe(0);

    // A newer reminder (t=3000) resurfaces above the watermark.
    const after = reduce(cleared, {
      kind: 'event',
      event: {
        type: 'ReminderCreated',
        id: 'r2',
        at: 3000,
        person: 'ava-chen',
        title: 'Water the plants',
        related: [],
      } as SimEvent,
    });
    expect(notificationCountFor(after, 'ava-chen')).toBe(1);
    expect(notificationsFor(after, 'ava-chen')[0].body).toBe('Water the plants');
  });
});
