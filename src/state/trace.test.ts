import { beforeEach, describe, expect, it } from 'vitest';
import { freshState, reduce } from './reducer';
import {
  buildSessionExport,
  clearTrace,
  countTap,
  getTapCount,
  getTrace,
  traceEvent,
} from './trace';
import type { SimEvent } from './events';

const msg: SimEvent = {
  type: 'MessageSent',
  id: 'm1',
  at: 1000,
  from: 'ava-chen',
  to: ['sam-ruiz'],
  body: 'hi',
  attachments: [],
};

describe('trace (the research-instrumentation overlay)', () => {
  beforeEach(clearTrace);

  it('stamps each event with wall time and the cumulative tap count', () => {
    countTap();
    countTap();
    traceEvent(msg);
    countTap();
    traceEvent({ type: 'ClockSet', at: 1000, to: 2000 });

    const trace = getTrace();
    expect(trace).toHaveLength(2);
    expect(trace[0]).toMatchObject({ seq: 0, type: 'MessageSent', simAt: 1000, taps: 2 });
    expect(trace[1]).toMatchObject({ seq: 1, type: 'ClockSet', taps: 3 });
    // Wall timestamps are real and monotonic — the "seconds" half of the study.
    expect(trace[0].wallAt).toBeGreaterThan(0);
    expect(trace[1].wallAt).toBeGreaterThanOrEqual(trace[0].wallAt);
    expect(getTapCount()).toBe(3);
  });

  it('clears alongside a world reset', () => {
    countTap();
    traceEvent(msg);
    clearTrace();
    expect(getTrace()).toHaveLength(0);
    expect(getTapCount()).toBe(0);
  });

  it('builds a session export pairing the log with its trace', () => {
    const state = reduce(freshState(), { kind: 'event', event: msg });
    countTap();
    traceEvent(msg);

    const out = buildSessionExport(state, 'mock');
    expect(out.version).toBe(1);
    expect(out.provider).toBe('mock');
    expect(out.taps).toBe(1);
    expect(out.events).toEqual(state.log);
    expect(out.trace).toHaveLength(1);
    expect(out.simClock).toBe(state.clock);
    expect(Date.parse(out.exportedAt)).not.toBeNaN();
  });
});
