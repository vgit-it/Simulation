import { describe, expect, it } from 'vitest';
import { freshState, type Message, type RuntimeState } from '../state';
import { dueAutopilotActions } from './index';

const SHARE_AT = new Date('2026-07-16T12:00:00').getTime();
const HOUR = 3_600_000;

function shareToSam(): Message {
  return {
    id: 'm1',
    at: SHARE_AT,
    from: 'ava-chen',
    to: ['sam-ruiz'],
    body: 'photos!',
    attachments: ['img-001'],
    intent: 'share-photos',
  };
}

function stateAt(clock: number, messages: Message[]): RuntimeState {
  return { ...freshState(), clock, messages };
}

describe('dueAutopilotActions', () => {
  it('does nothing before the behavior delay has elapsed', () => {
    // Sam's authored delay is 2h; only 1h has passed.
    const state = stateAt(SHARE_AT + 1 * HOUR, [shareToSam()]);
    expect(dueAutopilotActions(state, 'ava-chen')).toHaveLength(0);
  });

  it('replies once due, stamped at the DUE time, with the authored message', () => {
    const state = stateAt(SHARE_AT + 3 * HOUR, [shareToSam()]);
    const events = dueAutopilotActions(state, 'ava-chen');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'MessageSent',
      from: 'sam-ruiz',
      to: ['ava-chen'],
      at: SHARE_AT + 2 * HOUR, // Sam replied 2h after the share, not "now"
    });
    expect((events[0] as Message & { body: string }).body).toContain('great');
  });

  it('never autopilots the embodied person', () => {
    const state = stateAt(SHARE_AT + 3 * HOUR, [shareToSam()]);
    expect(dueAutopilotActions(state, 'sam-ruiz')).toHaveLength(0);
  });

  it('is idempotent: an existing reply suppresses further action', () => {
    const reply: Message = {
      id: 'm2',
      at: SHARE_AT + 2 * HOUR,
      from: 'sam-ruiz',
      to: ['ava-chen'],
      body: 'Whoa!',
      attachments: [],
    };
    const state = stateAt(SHARE_AT + 5 * HOUR, [shareToSam(), reply]);
    expect(dueAutopilotActions(state, 'ava-chen')).toHaveLength(0);
  });

  it('ignores plain text messages (no attachment ping-pong)', () => {
    const text: Message = { ...shareToSam(), attachments: [] };
    const state = stateAt(SHARE_AT + 5 * HOUR, [text]);
    expect(dueAutopilotActions(state, 'ava-chen')).toHaveLength(0);
  });

  it('respects each resident’s own delay (Maya waits 4h)', () => {
    const shareToMaya: Message = {
      ...shareToSam(),
      id: 'm3',
      to: ['maya-osei'],
    };
    const at3h = stateAt(SHARE_AT + 3 * HOUR, [shareToMaya]);
    expect(dueAutopilotActions(at3h, 'ava-chen')).toHaveLength(0);
    const at5h = stateAt(SHARE_AT + 5 * HOUR, [shareToMaya]);
    const events = dueAutopilotActions(at5h, 'ava-chen');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      from: 'maya-osei',
      at: SHARE_AT + 4 * HOUR,
    });
  });
});
