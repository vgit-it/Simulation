import { describe, expect, it } from 'vitest';
import { assembleContext } from '../context';
import { freshState } from '../state/reducer';
import type { Plan } from '../plans/types';
import { capabilityFor } from './capabilities';
import {
  absorbAnswer,
  firstPlanGap,
  missingSlots,
  resolvePlanSlots,
} from './requirements';

const session = { personId: 'ava-chen', deviceId: 'ava-phone' };
const ctx = assembleContext(session, freshState());
/** ctx with a live photo selection — as if the user picked photos on screen. */
const ctxWithPhotosSelected = assembleContext(
  { ...session, selection: { app: 'photos', kind: 'photos', ids: ['img-001'] } },
  freshState(),
);

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

describe('missingSlots (share-photos selection operand — the "which photos" regression)', () => {
  // A decider (an LLM especially) may leave a step's own ids empty, treating
  // the operand as "already covered by the user's selection" rather than
  // restating it. The selection slot must fall back to the LIVE ctx selection
  // instead of asking "Which photos do you want to share?" while photos are
  // visibly selected on screen.
  it('is satisfied by the live selection when the step carries no ids of its own', () => {
    const missing = missingSlots('share-photos', ctxWithPhotosSelected, [], {}, 'share this');
    expect(missing.map((s) => s.key)).not.toContain('photos');
  });

  it('is still MISSING with no ids and no active selection', () => {
    const missing = missingSlots('share-photos', ctx, [], {}, 'share this');
    expect(missing.map((s) => s.key)).toContain('photos');
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

describe('resolvePlanSlots (bind resolvable values onto a plan before it previews)', () => {
  // The reported bug's exact shape: a decider (e.g. Gemini) produces a
  // share-photos step with EMPTY ids, trusting the tool description's "already
  // satisfied by the user selection" wording rather than restating them.
  const emptyIdsShare = {
    id: 'share',
    app: 'photos',
    intent: 'share-photos',
    ids: [] as string[],
    description: 'Share it',
  };

  it('binds the live selection into an empty-ids selection slot', () => {
    const plan: Plan = { id: 'p', goal: 'Share', steps: [emptyIdsShare] };
    const resolved = resolvePlanSlots(plan, ctxWithPhotosSelected, 'share this');
    expect(resolved.steps[0].ids).toEqual(['img-001']);
    // ...and once bound, there's no longer a gap to ask about.
    expect(firstPlanGap(resolved, ctxWithPhotosSelected, 'share this')).toBeNull();
  });

  it('also derives recipients once ids are bound (img-001 is tagged with sam-ruiz)', () => {
    const plan: Plan = { id: 'p', goal: 'Share', steps: [emptyIdsShare] };
    const resolved = resolvePlanSlots(plan, ctxWithPhotosSelected, 'share this');
    expect(resolved.steps[0].payload).toEqual({ recipients: ['sam-ruiz'] });
  });

  it('is a no-op (same plan reference) when nothing needs binding', () => {
    const plan: Plan = {
      id: 'p',
      goal: 'Share',
      steps: [{ ...emptyIdsShare, ids: ['img-001'], payload: { recipients: ['sam-ruiz'] } }],
    };
    expect(resolvePlanSlots(plan, ctx, 'share this')).toBe(plan);
  });

  it('never overrides an explicit non-empty ids/payload the step already carries', () => {
    const plan: Plan = {
      id: 'p',
      goal: 'Share',
      steps: [{ ...emptyIdsShare, ids: ['img-004'], payload: { recipients: ['leo-park'] } }],
    };
    // ctxWithPhotosSelected has a DIFFERENT selection (img-001) — must not win
    // over the step's own explicit ids/payload.
    const resolved = resolvePlanSlots(plan, ctxWithPhotosSelected, 'share this');
    expect(resolved.steps[0].ids).toEqual(['img-004']);
    expect(resolved.steps[0].payload).toEqual({ recipients: ['leo-park'] });
  });

  it('leaves navigate steps (no intent) untouched', () => {
    const plan: Plan = {
      id: 'p',
      goal: 'Look',
      steps: [{ id: 'g', app: 'photos', description: 'Open Photos' }],
    };
    expect(resolvePlanSlots(plan, ctxWithPhotosSelected, 'share this')).toBe(plan);
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
