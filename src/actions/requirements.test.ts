import { describe, expect, it } from 'vitest';
import { assembleContext } from '../context';
import { freshState } from '../state/reducer';
import type { Plan } from '../plans/types';
import { capabilityFor } from './capabilities';
import { absorbAnswer, firstPlanGap, missingSlots } from './requirements';

const session = { personId: 'ava-chen', deviceId: 'ava-phone' };
const ctx = assembleContext(session, freshState());

/** The declared recipients slot for share-photos. */
const recipientsSlot = capabilityFor('share-photos').slots.find(
  (s) => s.key === 'recipients',
)!;
const titleSlot = capabilityFor('create-reminder').slots.find(
  (s) => s.key === 'title',
)!;

describe('missingSlots (share-photos recipients)', () => {
  it('is satisfied when the request names a contact', () => {
    // img-003 is tagged with leo-park + sam-ruiz; "share with Leo" names one.
    const missing = missingSlots(
      'share-photos',
      ctx,
      ['img-003'],
      {},
      'share this with Leo',
    );
    expect(missing.map((s) => s.key)).not.toContain('recipients');
  });

  it('is satisfied by the draftShare default when the photo has other people', () => {
    // No name in the request, but img-003 has taggable recipients to default to.
    const missing = missingSlots('share-photos', ctx, ['img-003'], {}, 'share this');
    expect(missing.map((s) => s.key)).not.toContain('recipients');
  });

  it('is MISSING when there is no one to default to and no name', () => {
    // img-004 is a solo photo (only ava-chen) — nobody to draft as recipient.
    const missing = missingSlots('share-photos', ctx, ['img-004'], {}, 'share this');
    expect(missing.map((s) => s.key)).toEqual(['recipients']);
  });

  it('is satisfied by an explicit payload override', () => {
    const missing = missingSlots(
      'share-photos',
      ctx,
      ['img-004'],
      { recipients: ['leo-park'] },
      'share this',
    );
    expect(missing).toHaveLength(0);
  });
});

describe('missingSlots (create-reminder title)', () => {
  it('is missing with no title', () => {
    const missing = missingSlots('create-reminder', ctx, [], { title: '' }, 'remind me');
    expect(missing.map((s) => s.key)).toEqual(['title']);
  });

  it('is satisfied once a title is present', () => {
    const missing = missingSlots(
      'create-reminder',
      ctx,
      [],
      { title: 'call the plumber' },
      'remind me',
    );
    expect(missing).toHaveLength(0);
  });
});

describe('absorbAnswer (fold a free-text answer into a slot)', () => {
  it('resolves a named person for the recipients slot', () => {
    const payload = absorbAnswer(
      'share-photos',
      recipientsSlot,
      'Leo',
      ctx,
      ['img-004'],
      {},
    );
    expect(payload).toEqual({ recipients: ['leo-park'] });
  });

  it('takes the answer verbatim for a plain payload slot (title)', () => {
    const payload = absorbAnswer(
      'create-reminder',
      titleSlot,
      '  water the plants  ',
      ctx,
      [],
      {},
    );
    expect(payload).toEqual({ title: 'water the plants' });
  });

  it('leaves the payload unchanged when a name cannot be resolved', () => {
    const payload = absorbAnswer(
      'share-photos',
      recipientsSlot,
      'nobody-by-that-name',
      ctx,
      ['img-004'],
      {},
    );
    expect(payload).toEqual({});
  });
});

describe('firstPlanGap (where a plan needs an answer before it runs)', () => {
  const remindStep = {
    id: 'remind',
    app: 'reminders',
    intent: 'create-reminder',
    ids: [],
    payload: { title: '' },
    description: 'Add a reminder',
  };

  it('finds the first action step with a missing required slot', () => {
    const plan: Plan = { id: 'p', goal: 'Remind', steps: [remindStep] };
    const gap = firstPlanGap(plan, ctx, 'remind me');
    expect(gap?.stepIndex).toBe(0);
    expect(gap?.slot.key).toBe('title');
  });

  it('returns null once every step is fully specified', () => {
    const plan: Plan = {
      id: 'p',
      goal: 'Remind',
      steps: [{ ...remindStep, payload: { title: 'buy milk' } }],
    };
    expect(firstPlanGap(plan, ctx, 'remind me')).toBeNull();
  });

  it('ignores navigate steps (no intent)', () => {
    const plan: Plan = {
      id: 'p',
      goal: 'Look',
      steps: [{ id: 'g', app: 'photos', description: 'Open Photos' }],
    };
    expect(firstPlanGap(plan, ctx, 'show me')).toBeNull();
  });
});
