import { describe, expect, it } from 'vitest';
import { assembleContext } from '../context';
import { freshState, reduce } from '../state/reducer';
import { capabilityFor, effectiveStakes } from './capabilities';
import { propose } from './index';

const session = { personId: 'ava-chen', deviceId: 'ava-phone' };
const ctx = assembleContext(
  { ...session, selection: { app: 'photos', kind: 'photos', ids: ['img-003'] } },
  freshState(),
);

describe('effectiveStakes (declared baseline, escalated by blast radius)', () => {
  it('a high baseline is always high', () => {
    expect(effectiveStakes('high', 0)).toBe('high');
    expect(effectiveStakes('high', 99)).toBe('high');
  });
  it('a low baseline with few recipients stays low', () => {
    expect(effectiveStakes('low', 0)).toBe('low');
    expect(effectiveStakes('low', 4)).toBe('low');
  });
  it('a low baseline escalates to high on a large blast radius', () => {
    expect(effectiveStakes('low', 5)).toBe('high');
  });
});

describe('declared stakes flow from the world file onto the capability', () => {
  it('share-photos and send-message are high; create-reminder is low', () => {
    expect(capabilityFor('share-photos').stakes).toBe('high');
    expect(capabilityFor('send-message').stakes).toBe('high');
    expect(capabilityFor('create-reminder').stakes).toBe('low');
  });
});

describe('Proposal carries effective stakes', () => {
  it('a share proposal is high-stakes', () => {
    const p = propose('share-photos', ctx, ['img-003'], { recipients: ['leo-park'] });
    expect(p.stakes).toBe('high');
  });
  it('a reminder proposal is low-stakes', () => {
    const p = propose('create-reminder', ctx, [], { title: 'call the plumber' });
    expect(p.stakes).toBe('low');
  });
  it('an amended high-stakes proposal stays high', () => {
    const p = propose('share-photos', ctx, ['img-003'], { recipients: ['leo-park'] });
    const amended = p.amend!({ recipientIds: ['leo-park', 'sam-ruiz'] });
    expect(amended.stakes).toBe('high');
  });
});

describe('ConsentDecision is telemetry-only (logged, no derived change)', () => {
  it('appends to the log without altering derived state', () => {
    const before = freshState();
    const after = reduce(before, {
      kind: 'event',
      event: {
        type: 'ConsentDecision',
        at: before.clock,
        person: 'ava-chen',
        intent: 'share-photos',
        stakes: 'high',
        decision: 'granted',
      },
    });
    expect(after.log).toHaveLength(1);
    expect(after.log[0].type).toBe('ConsentDecision');
    // Everything derived is untouched.
    expect(after.messages).toEqual(before.messages);
    expect(after.plans).toEqual(before.plans);
    expect(after.reminders).toEqual(before.reminders);
  });
});
