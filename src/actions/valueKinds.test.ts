import { describe, expect, it } from 'vitest';
import { assembleContext } from '../context';
import { freshState } from '../state/reducer';
import { matchContacts } from '../intelligence/shareRecipients';
import type { Plan } from '../plans/types';
import { capabilityFor } from './capabilities';
import { bindGapValue, firstPlanGap } from './requirements';
import { parseSlotAnswer } from './valueKinds';

const session = { personId: 'ava-chen', deviceId: 'ava-phone' };
const ctx = assembleContext(session, freshState());

const recipientsSlot = capabilityFor('share-photos').slots.find(
  (s) => s.key === 'recipients',
)!;
const titleSlot = capabilityFor('create-reminder').slots.find(
  (s) => s.key === 'title',
)!;

describe('slot wiring: valueKind flows from the world file onto the Slot', () => {
  it('share recipients declare valueKind contact', () => {
    expect(recipientsSlot.valueKind).toBe('contact');
  });
  it('the photos operand declares valueKind photo-set', () => {
    const operand = capabilityFor('share-photos').slots.find(
      (s) => s.source === 'selection',
    )!;
    expect(operand.valueKind).toBe('photo-set');
  });
  it('a reminder title declares valueKind text', () => {
    expect(titleSlot.valueKind).toBe('text');
  });
});

describe('matchContacts (name → the owner\'s contacts)', () => {
  it('matches a first name mentioned in text (substring)', () => {
    expect(matchContacts('ava-chen', 'Leo').map((c) => c.id)).toEqual([
      'leo-park',
    ]);
  });
  it('matches several as a set when the text names several', () => {
    const ids = matchContacts('ava-chen', 'sam and leo').map((c) => c.id);
    expect(ids).toContain('sam-ruiz');
    expect(ids).toContain('leo-park');
  });
  it('matches a first-name prefix for a single bare token', () => {
    expect(matchContacts('ava-chen', 'Sa').map((c) => c.id)).toEqual([
      'sam-ruiz',
    ]);
  });
  it('returns [] for a name it does not know', () => {
    expect(matchContacts('ava-chen', 'nobody-here')).toEqual([]);
  });
});

describe('parseSlotAnswer (the natural-language answer channel)', () => {
  it('contact: one named person → one candidate whose value is the id set', () => {
    const cands = parseSlotAnswer('share-photos', recipientsSlot, 'Leo', ctx, [], {});
    expect(cands).toHaveLength(1);
    expect(cands[0].value).toEqual(['leo-park']);
    expect(cands[0].confidence).toBe('high');
  });

  it('contact: several named → one candidate carrying the whole set', () => {
    const cands = parseSlotAnswer(
      'share-photos',
      recipientsSlot,
      'sam and leo',
      ctx,
      [],
      {},
    );
    expect(cands).toHaveLength(1);
    expect(cands[0].value).toContain('sam-ruiz');
    expect(cands[0].value).toContain('leo-park');
  });

  it('contact: an unknown name yields no candidate (→ re-ask)', () => {
    expect(
      parseSlotAnswer('share-photos', recipientsSlot, 'zzz', ctx, [], {}),
    ).toHaveLength(0);
  });

  it('text: the answer verbatim (trimmed)', () => {
    const cands = parseSlotAnswer(
      'create-reminder',
      titleSlot,
      '  water the plants  ',
      ctx,
      [],
      {},
    );
    expect(cands).toHaveLength(1);
    expect(cands[0].value).toBe('water the plants');
  });

  it('text: an empty answer yields no candidate', () => {
    expect(
      parseSlotAnswer('create-reminder', titleSlot, '   ', ctx, [], {}),
    ).toHaveLength(0);
  });

  // NB: a single bare token matching MULTIPLE contacts (→ >1 candidate, the
  // disambiguation path) isn't reachable with the seed residents (Ava/Sam/
  // Maya/Leo/Nadia/Theo have no colliding first-name prefixes), so it's covered
  // by code + the surface wiring, not a seed-driven unit case.
});

describe('bindGapValue (one bind path for chip / picker / choice)', () => {
  const step = {
    id: 'share',
    app: 'photos',
    intent: 'share-photos',
    ids: ['img-004'],
    description: 'Share it',
  };
  const plan: Plan = { id: 'p', goal: 'Share', steps: [step] };

  it('binds a payload value onto the gapped step and clears the gap', () => {
    const gap = firstPlanGap(plan, ctx, 'share this')!; // recipients (elicit)
    expect(gap.slot.key).toBe('recipients');
    const bound = bindGapValue(plan, gap, ['leo-park']);
    expect(bound.steps[0].payload?.recipients).toEqual(['leo-park']);
    expect(firstPlanGap(bound, ctx, 'share this')).toBeNull();
  });

  it('binds a selection value onto the step ids', () => {
    const operand = capabilityFor('share-photos').slots.find(
      (s) => s.source === 'selection',
    )!;
    const gap = { stepIndex: 0, slot: operand, candidate: null, band: 'elicit' as const };
    const bound = bindGapValue(plan, gap, ['img-009']);
    expect(bound.steps[0].ids).toEqual(['img-009']);
  });
});
