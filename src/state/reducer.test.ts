import { describe, expect, it } from 'vitest';
import { freshState, hydrate, reduce } from './reducer';
import type { SimEvent } from './events';

const msg: SimEvent = {
  type: 'MessageSent',
  id: 'm1',
  at: 1000,
  from: 'ava-chen',
  to: ['sam-ruiz'],
  body: 'hi',
  attachments: ['img-001'],
  intent: 'share-photos',
};

describe('reducer', () => {
  it('appends events to the log and derives messages', () => {
    const s = reduce(freshState(), { kind: 'event', event: msg });
    expect(s.log).toHaveLength(1);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].to).toEqual(['sam-ruiz']);
  });

  it('records facts per person', () => {
    const fact: SimEvent = {
      type: 'FactRecorded',
      at: 1,
      person: 'ava-chen',
      key: 'k',
      value: 'v',
    };
    const s = reduce(freshState(), { kind: 'event', event: fact });
    expect(s.facts['ava-chen']).toEqual([{ at: 1, key: 'k', value: 'v' }]);
  });

  it('tracks thread reads per person (latest read wins)', () => {
    const reads: SimEvent[] = [
      { type: 'ThreadRead', at: 5, person: 'ava-chen', thread: 'ava-chen+sam-ruiz' },
      { type: 'ThreadRead', at: 3, person: 'ava-chen', thread: 'ava-chen+sam-ruiz' },
    ];
    const s = reads.reduce(
      (acc, event) => reduce(acc, { kind: 'event', event }),
      freshState(),
    );
    expect(s.reads['ava-chen']['ava-chen+sam-ruiz']).toBe(5); // max, not last
  });

  it('folds ChatMessage events into per-person history', () => {
    const turns: SimEvent[] = [
      { type: 'ChatMessage', at: 1, person: 'ava-chen', role: 'user', text: 'hi' },
      { type: 'ChatMessage', at: 1, person: 'ava-chen', role: 'assistant', text: 'Hi!' },
      { type: 'ChatMessage', at: 2, person: 'sam-ruiz', role: 'user', text: 'yo' },
    ];
    const s = turns.reduce(
      (acc, event) => reduce(acc, { kind: 'event', event }),
      freshState(),
    );
    expect(s.chats).toHaveLength(3);
    expect(s.chats.filter((c) => c.person === 'ava-chen')).toHaveLength(2);
  });

  it('moves the clock on ClockSet', () => {
    const s = reduce(freshState(), {
      kind: 'event',
      event: { type: 'ClockSet', at: 0, to: 42 },
    });
    expect(s.clock).toBe(42);
  });

  it('reset returns to seed', () => {
    const s1 = reduce(freshState(), { kind: 'event', event: msg });
    const s2 = reduce(s1, { kind: 'reset' });
    expect(s2.log).toHaveLength(0);
    expect(s2.messages).toHaveLength(0);
  });

  it('folds a plan lifecycle: proposed -> started (struck) -> steps -> done', () => {
    const events: SimEvent[] = [
      { type: 'PlanProposed', at: 1, person: 'ava-chen', planId: 'p1', goal: 'Share these', steps: 4 },
      { type: 'PlanStarted', at: 2, person: 'ava-chen', planId: 'p1', goal: 'Share these', steps: 3, supervision: 'confirm-once', struck: 1 },
      { type: 'PlanStepCompleted', at: 3, person: 'ava-chen', planId: 'p1', stepIndex: 0, label: 'Open Photos' },
      { type: 'PlanStepCompleted', at: 4, person: 'ava-chen', planId: 'p1', stepIndex: 1, label: 'Share 2 photos' },
    ];
    let s = events.reduce(
      (acc, event) => reduce(acc, { kind: 'event', event }),
      freshState(),
    );
    expect(s.plans).toHaveLength(1); // PlanStarted updates the proposed entry
    expect(s.plans[0]).toMatchObject({
      outcome: 'running',
      steps: 3,
      struck: 1,
      supervision: 'confirm-once',
      stepsDone: 2,
    });
    s = reduce(s, {
      kind: 'event',
      event: { type: 'PlanCompleted', at: 5, person: 'ava-chen', planId: 'p1', outcome: 'completed' },
    });
    expect(s.plans[0].outcome).toBe('completed');
  });

  it('records a declined plan (proposed, never started)', () => {
    const events: SimEvent[] = [
      { type: 'PlanProposed', at: 1, person: 'ava-chen', planId: 'p2', goal: 'Message Sam', steps: 2 },
      { type: 'PlanCompleted', at: 2, person: 'ava-chen', planId: 'p2', outcome: 'declined' },
    ];
    const s = events.reduce(
      (acc, event) => reduce(acc, { kind: 'event', event }),
      freshState(),
    );
    expect(s.plans[0]).toMatchObject({ outcome: 'declined', stepsDone: 0 });
  });

  it('hydrate replays a persisted log to the same derived state', () => {
    const live = reduce(freshState(), { kind: 'event', event: msg });
    const replayed = hydrate(live.log);
    expect(replayed.messages).toEqual(live.messages);
    expect(replayed.log).toEqual(live.log);
  });
});
