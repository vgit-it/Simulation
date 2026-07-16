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

  it('hydrate replays a persisted log to the same derived state', () => {
    const live = reduce(freshState(), { kind: 'event', event: msg });
    const replayed = hydrate(live.log);
    expect(replayed.messages).toEqual(live.messages);
    expect(replayed.log).toEqual(live.log);
  });
});
