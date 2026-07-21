import { describe, expect, it } from 'vitest';
import { assembleContext } from '../context';
import { freshState } from '../state/reducer';
import type { Plan } from '../plans/types';
import { capabilityFor } from './capabilities';
import {
  absorbAnswer,
  acceptGap,
  bandFor,
  candidate,
  firstPlanGap,
  meetsThreshold,
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

/** One-step share plans used across the gap/band tests. */
const shareStep = (ids: string[], payload?: Record<string, unknown>) => ({
  id: 'share',
  app: 'photos',
  intent: 'share-photos',
  ids,
  ...(payload && { payload }),
  description: 'Share it',
});

describe('missingSlots (share-photos recipients) — banded at the default threshold', () => {
  it('binds silently (not missing) when the request names a contact — high', () => {
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

  it('NEEDS confirmation (missing) for the "everyone tagged" default — medium', () => {
    // No name in the request; img-003's tags give a default, but at the
    // confirm-once threshold a medium default is confirmed, not silently sent.
    const missing = missingSlots('share-photos', ctx, ['img-003'], {}, 'share this');
    expect(missing.map((s) => s.key)).toContain('recipients');
  });

  it('is ELICITED (missing) when there is no one to default to and no name', () => {
    // img-004 is a solo photo (only ava-chen) — nobody to draft as recipient.
    const missing = missingSlots('share-photos', ctx, ['img-004'], {}, 'share this');
    expect(missing.map((s) => s.key)).toEqual(['recipients']);
  });

  it('binds silently (not missing) for an explicit payload override — high', () => {
    const missing = missingSlots(
      'share-photos',
      ctx,
      ['img-004'],
      { recipients: ['leo-park'] },
      'share this',
    );
    expect(missing).toHaveLength(0);
  });

  it('binds the medium default silently under `auto` supervision (low threshold)', () => {
    const missing = missingSlots(
      'share-photos',
      ctx,
      ['img-003'],
      {},
      'share this',
      'auto',
    );
    expect(missing.map((s) => s.key)).not.toContain('recipients');
  });
});

describe('meetsThreshold (supervision = confidence threshold)', () => {
  it('auto acts on medium guesses', () => {
    expect(meetsThreshold('medium', 'auto')).toBe(true);
    expect(meetsThreshold('high', 'auto')).toBe(true);
  });
  it('confirm-once binds high but confirms medium', () => {
    expect(meetsThreshold('high', 'confirm-once')).toBe(true);
    expect(meetsThreshold('medium', 'confirm-once')).toBe(false);
  });
  it('confirm-each confirms even a high guess', () => {
    expect(meetsThreshold('high', 'confirm-each')).toBe(false);
  });
});

describe('bandFor (ok / confirm / elicit)', () => {
  it('a high candidate binds (ok) at confirm-once', () => {
    expect(bandFor(recipientsSlot, candidate(['sam-ruiz'], 'high', 'request'), 'confirm-once')).toBe('ok');
  });
  it('a medium candidate confirms at confirm-once', () => {
    expect(bandFor(recipientsSlot, candidate(['sam-ruiz'], 'medium', 'default'), 'confirm-once')).toBe('confirm');
  });
  it('no candidate elicits', () => {
    expect(bandFor(recipientsSlot, null, 'confirm-once')).toBe('elicit');
  });
  it('an optional slot is always ok', () => {
    const optional = { ...recipientsSlot, optional: true };
    expect(bandFor(optional, null, 'confirm-each')).toBe('ok');
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

describe('resolvePlanSlots (bind only HIGH-confidence values before preview)', () => {
  it('binds the live selection into an empty-ids selection slot (high)', () => {
    const plan: Plan = { id: 'p', goal: 'Share', steps: [shareStep([])] };
    const resolved = resolvePlanSlots(plan, ctxWithPhotosSelected, 'share this');
    expect(resolved.steps[0].ids).toEqual(['img-001']);
  });

  it('does NOT silently bind the medium "everyone tagged" default', () => {
    // img-001 is tagged with sam-ruiz — a medium default. It must stay a
    // confirm gap, not get bound onto the plan and committed unseen.
    const plan: Plan = { id: 'p', goal: 'Share', steps: [shareStep([])] };
    const resolved = resolvePlanSlots(plan, ctxWithPhotosSelected, 'share this');
    expect(resolved.steps[0].payload?.recipients).toBeUndefined();
    // ...and that leaves a confirm gap for the recipients.
    const gap = firstPlanGap(resolved, ctxWithPhotosSelected, 'share this');
    expect(gap?.slot.key).toBe('recipients');
    expect(gap?.band).toBe('confirm');
    expect(gap?.candidate?.value).toEqual(['sam-ruiz']);
  });

  it('is a no-op (same plan reference) when nothing needs binding', () => {
    const plan: Plan = {
      id: 'p',
      goal: 'Share',
      steps: [shareStep(['img-001'], { recipients: ['sam-ruiz'] })],
    };
    expect(resolvePlanSlots(plan, ctx, 'share this')).toBe(plan);
  });

  it('never overrides an explicit non-empty ids/payload the step already carries', () => {
    const plan: Plan = {
      id: 'p',
      goal: 'Share',
      steps: [shareStep(['img-004'], { recipients: ['leo-park'] })],
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

describe('acceptGap (accept a confirm gap\'s pre-filled candidate)', () => {
  it('binds a payload candidate so the slot no longer gaps', () => {
    const plan: Plan = { id: 'p', goal: 'Share', steps: [shareStep(['img-003'])] };
    const gap = firstPlanGap(plan, ctx, 'share this')!;
    expect(gap.band).toBe('confirm');
    const accepted = acceptGap(plan, gap);
    expect(accepted.steps[0].payload?.recipients).toEqual(gap.candidate!.value);
    // Once accepted the recipients read as an explicit (high) input — no gap.
    const next = firstPlanGap(accepted, ctx, 'share this');
    expect(next).toBeNull();
  });

  it('binds a selection candidate onto the step ids', () => {
    const plan: Plan = { id: 'p', goal: 'Share', steps: [shareStep([])] };
    // The photos operand resolves to the live selection at high confidence, so
    // it never confirms — but acceptGap must still bind a selection candidate.
    const gap = {
      stepIndex: 0,
      slot: capabilityFor('share-photos').slots.find((s) => s.source === 'selection')!,
      candidate: candidate(['img-009'], 'medium', 'selection'),
      band: 'confirm' as const,
    };
    const accepted = acceptGap(plan, gap);
    expect(accepted.steps[0].ids).toEqual(['img-009']);
  });
});

describe('firstPlanGap (where a plan needs the user before it runs)', () => {
  const remindStep = {
    id: 'remind',
    app: 'reminders',
    intent: 'create-reminder',
    ids: [],
    payload: { title: '' },
    description: 'Add a reminder',
  };

  it('finds the first action step with a slot that cannot bind silently', () => {
    const plan: Plan = { id: 'p', goal: 'Remind', steps: [remindStep] };
    const gap = firstPlanGap(plan, ctx, 'remind me');
    expect(gap?.stepIndex).toBe(0);
    expect(gap?.slot.key).toBe('title');
    expect(gap?.band).toBe('elicit');
    expect(gap?.candidate).toBeNull();
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
