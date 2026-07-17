import { describe, expect, it } from 'vitest';
import { freshState, reduce, type RuntimeState } from './reducer';
import { inboxThreads, messagesInvolving } from './selectors';
import type { SimEvent } from './events';

function withMessages(...msgs: SimEvent[]): RuntimeState {
  return msgs.reduce(
    (s, event) => reduce(s, { kind: 'event', event }),
    freshState(),
  );
}

const share: SimEvent = {
  type: 'MessageSent',
  id: 'm1',
  at: 1000,
  from: 'ava-chen',
  to: ['sam-ruiz', 'maya-osei'],
  body: 'Sharing these!',
  attachments: ['img-001'],
  intent: 'share-photos',
};

describe('inbox selectors', () => {
  it('a recipient receives a message they did not send', () => {
    const state = withMessages(share);
    expect(messagesInvolving(state, 'sam-ruiz')).toHaveLength(1);
    // Someone not on the message sees nothing.
    expect(messagesInvolving(state, 'leo-park')).toHaveLength(0);
  });

  it('groups into a thread whose label excludes the viewer', () => {
    const state = withMessages(share);
    const threads = inboxThreads(state, 'sam-ruiz');
    expect(threads).toHaveLength(1);
    expect(threads[0].participantIds).not.toContain('sam-ruiz');
    expect(new Set(threads[0].participantIds)).toEqual(
      new Set(['ava-chen', 'maya-osei']),
    );
  });

  it('collapses both directions into one thread, newest message last', () => {
    const reply: SimEvent = {
      type: 'MessageSent',
      id: 'm2',
      at: 2000,
      from: 'sam-ruiz',
      to: ['ava-chen', 'maya-osei'],
      body: 'Love them!',
      attachments: [],
    };
    const state = withMessages(share, reply);
    const threads = inboxThreads(state, 'ava-chen');
    expect(threads).toHaveLength(1);
    expect(threads[0].messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(threads[0].last.id).toBe('m2');
  });
});
