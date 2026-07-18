import { describe, expect, it } from 'vitest';
import { freshState, reduce } from './reducer';
import { LEGACY_SESSION, chatHistoryFor, chatSessionsFor } from './selectors';
import type { SimEvent } from './events';

function fold(events: SimEvent[]) {
  return events.reduce(
    (acc, event) => reduce(acc, { kind: 'event', event }),
    freshState(),
  );
}

const turn = (
  at: number,
  role: 'user' | 'assistant',
  text: string,
  session?: string,
): SimEvent => ({
  type: 'ChatMessage',
  at,
  person: 'ava-chen',
  role,
  text,
  session,
});

describe('assistant conversation threads', () => {
  it('groups turns into one thread per session, newest activity first', () => {
    const s = fold([
      turn(1, 'user', 'share this week', 'chat_a'),
      turn(1, 'assistant', 'Here is a plan.', 'chat_a'),
      turn(5, 'user', 'how many photos with Sam?', 'chat_b'),
      turn(5, 'assistant', 'You share 3 photos.', 'chat_b'),
    ]);
    const sessions = chatSessionsFor(s, 'ava-chen');
    expect(sessions.map((x) => x.id)).toEqual(['chat_b', 'chat_a']);
    expect(sessions[0].title).toBe('how many photos with Sam?');
    expect(sessions[1].turns).toHaveLength(2);
    expect(sessions[0].last.text).toBe('You share 3 photos.');
  });

  it('breaks sim-time ties by log order (the clock may not move between asks)', () => {
    const s = fold([
      turn(1, 'user', 'first ask', 'chat_a'),
      turn(1, 'assistant', 'A.', 'chat_a'),
      turn(1, 'user', 'second ask', 'chat_b'), // same sim instant, later in log
      turn(1, 'assistant', 'B.', 'chat_b'),
    ]);
    expect(chatSessionsFor(s, 'ava-chen').map((x) => x.id)).toEqual([
      'chat_b',
      'chat_a',
    ]);
  });

  it('scopes history to a session — a fresh id starts an empty conversation', () => {
    const s = fold([
      turn(1, 'user', 'hello', 'chat_a'),
      turn(1, 'assistant', 'Hi!', 'chat_a'),
    ]);
    expect(chatHistoryFor(s, 'ava-chen')).toHaveLength(2); // unscoped: all
    expect(chatHistoryFor(s, 'ava-chen', 'chat_a')).toHaveLength(2);
    expect(chatHistoryFor(s, 'ava-chen', 'chat_fresh')).toHaveLength(0);
  });

  it('resuming a thread appends to it, not to a new one', () => {
    const s = fold([
      turn(1, 'user', 'first ask', 'chat_a'),
      turn(1, 'assistant', 'First answer.', 'chat_a'),
      turn(9, 'user', 'follow-up', 'chat_a'),
      turn(9, 'assistant', 'Follow-up answer.', 'chat_a'),
    ]);
    const sessions = chatSessionsFor(s, 'ava-chen');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].turns).toHaveLength(4);
    expect(sessions[0].title).toBe('first ask'); // title stays the opener
  });

  it('collapses pre-thread turns (no session) into one legacy conversation', () => {
    const s = fold([
      turn(1, 'user', 'old question'),
      turn(1, 'assistant', 'Old answer.'),
      turn(5, 'user', 'new question', 'chat_a'),
    ]);
    const sessions = chatSessionsFor(s, 'ava-chen');
    expect(sessions).toHaveLength(2);
    const legacy = sessions.find((x) => x.id === LEGACY_SESSION)!;
    expect(legacy.turns).toHaveLength(2);
    expect(chatHistoryFor(s, 'ava-chen', LEGACY_SESSION)).toHaveLength(2);
  });

  it('keeps people separate', () => {
    const s = fold([
      turn(1, 'user', 'mine', 'chat_a'),
      {
        type: 'ChatMessage',
        at: 2,
        person: 'sam-ruiz',
        role: 'user',
        text: 'his',
        session: 'chat_b',
      },
    ]);
    expect(chatSessionsFor(s, 'ava-chen')).toHaveLength(1);
    expect(chatSessionsFor(s, 'sam-ruiz')).toHaveLength(1);
  });
});
