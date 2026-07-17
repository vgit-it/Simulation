import { describe, expect, it } from 'vitest';
import { freshState, reduce } from '../state/reducer';
import { getScenario } from '../world';
import { resolveStep } from './runner';

describe('scenario step runner', () => {
  it('resolves a clock step to a ClockSet event', () => {
    const state = freshState();
    const result = resolveStep(
      { kind: 'clock', at: new Date('2026-07-16T13:00:00') },
      state,
    );
    expect(result.events).toEqual([
      { type: 'ClockSet', at: state.clock, to: new Date('2026-07-16T13:00:00').getTime() },
    ]);
    expect(result.focus).toBeUndefined();
    expect(result.screen).toBeUndefined();
  });

  it('resolves a focus step to a screen + POV, with AppOpened only for app screens', () => {
    const state = freshState();

    const home = resolveStep(
      { kind: 'focus', person: 'sam-ruiz', screen: 'home' },
      state,
    );
    expect(home.focus).toEqual({ personId: 'sam-ruiz', deviceId: undefined });
    expect(home.screen).toEqual({ kind: 'home' });
    expect(home.events).toEqual([]);

    const app = resolveStep(
      { kind: 'focus', person: 'sam-ruiz', screen: { app: 'messages' } },
      state,
    );
    expect(app.screen).toEqual({ kind: 'app', appId: 'messages' });
    expect(app.events).toEqual([
      { type: 'AppOpened', at: state.clock, person: 'sam-ruiz', appId: 'messages' },
    ]);
  });

  it('resolves a share step through the real propose/commit pipeline', () => {
    const state = freshState();
    const result = resolveStep(
      { kind: 'share', person: 'ava-chen', photos: ['img-001', 'img-002'] },
      state,
    );

    expect(result.focus).toEqual({ personId: 'ava-chen', deviceId: 'ava-phone' });
    expect(result.screen).toEqual({ kind: 'app', appId: 'photos' });

    const sent = result.events.find((e) => e.type === 'MessageSent');
    expect(sent).toBeDefined();
    if (sent?.type === 'MessageSent') {
      expect(sent.from).toBe('ava-chen');
      expect(new Set(sent.to)).toEqual(new Set(['sam-ruiz', 'maya-osei']));
      expect(new Set(sent.attachments)).toEqual(new Set(['img-001', 'img-002']));
    }
  });

  it('the authored weekend-share scenario resolves and dispatches every step', () => {
    const scenario = getScenario('weekend-share');
    let state = freshState();
    for (const step of scenario.steps) {
      const result = resolveStep(step, state);
      for (const event of result.events) {
        state = reduce(state, { kind: 'event', event });
      }
    }
    expect(state.messages).toHaveLength(1);
    expect(new Set(state.messages[0].to)).toEqual(
      new Set(['sam-ruiz', 'maya-osei']),
    );
  });
});
