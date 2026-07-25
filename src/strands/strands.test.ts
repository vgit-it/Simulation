import { describe, expect, it } from 'vitest';
import { assembleContext } from '../context';
import { intelligenceFor } from '../intelligence';
import { freshState, reduce, type SimEvent } from '../state';
import { listCapabilities } from '../actions';
import { getApp, getPerson } from '../world';
import { collectItems, unassignedItems } from './collect';
import { consolidateDeterministic, reconcileStrands } from './consolidate';
import { strandsFor } from './index';
import type { Strand } from './types';

function fold(events: SimEvent[]) {
  return events.reduce(
    (acc, event) => reduce(acc, { kind: 'event', event }),
    freshState(),
  );
}

const AVA = 'ava-chen';
const session = { personId: AVA, deviceId: 'ava-phone' };

const chat = (at: number, text: string, id: string): SimEvent => ({
  type: 'ChatMessage',
  at,
  person: AVA,
  role: 'user',
  text,
  session: id,
});

const reminder = (at: number, id: string, title: string): SimEvent => ({
  type: 'ReminderCreated',
  id,
  at,
  person: AVA,
  title,
  related: [],
});

const strand = (id: string, title: string, extra: Partial<Strand> = {}): Strand => ({
  id,
  title,
  summary: '',
  status: 'active',
  icon: '🧵',
  items: [],
  ...extra,
});

describe('strandsFor — authored seed + runtime consolidation', () => {
  it('returns the authored seed when nothing has been consolidated', () => {
    const s = freshState();
    const seeded = getPerson(AVA).strands;
    expect(seeded.length).toBeGreaterThan(0);
    expect(strandsFor(s, AVA)).toEqual(seeded);
  });

  it('normalizes authored items with a stable source and a sim-time anchor', () => {
    const [first] = getPerson(AVA).strands;
    expect(first.items[0].source).toBe(`seed:${first.id}:0`);
    expect(Number.isFinite(first.items[0].at)).toBe(true);
  });

  it('overrides a seed strand by id, appends new ones, keeps untouched ones', () => {
    const seeded = getPerson(AVA).strands;
    const target = seeded[0];
    const s = fold([
      {
        type: 'StrandsConsolidated',
        at: 1,
        person: AVA,
        sources: 1,
        strands: [
          { ...target, title: 'Renamed by consolidation' },
          strand('brand-new', 'Brand new'),
        ],
      },
    ]);
    const merged = strandsFor(s, AVA);
    expect(merged[0].id).toBe(target.id);
    expect(merged[0].title).toBe('Renamed by consolidation');
    // A seed strand the consolidation never mentioned survives, in place.
    expect(merged.map((x) => x.id)).toEqual([
      ...seeded.map((x) => x.id),
      'brand-new',
    ]);
  });

  it('keeps people separate', () => {
    const s = fold([
      {
        type: 'StrandsConsolidated',
        at: 1,
        person: AVA,
        sources: 0,
        strands: [strand('avas-only', "Ava's")],
      },
    ]);
    expect(strandsFor(s, AVA).some((x) => x.id === 'avas-only')).toBe(true);
    expect(strandsFor(s, 'sam-ruiz').some((x) => x.id === 'avas-only')).toBe(
      false,
    );
  });
});

describe('collectItems / unassignedItems', () => {
  it('turns log activity into source-keyed candidate items', () => {
    const s = fold([
      chat(10, 'plan the beach trip', 'chat_a'),
      reminder(20, 'rem_1', 'print the sunset photo'),
    ]);
    const items = collectItems(s, AVA);
    expect(items.map((i) => i.source).sort()).toEqual([
      'chat:chat_a',
      'rem:rem_1',
    ]);
    expect(items[0].at).toBeLessThanOrEqual(items[1].at); // oldest first
  });

  it('drops items already filed into a strand', () => {
    const s = fold([chat(10, 'plan the beach trip', 'chat_a')]);
    const filed = [
      strand('existing', 'Existing', {
        items: [
          {
            source: 'chat:chat_a',
            kind: 'chat',
            at: 10,
            text: 'plan the beach trip',
            refs: [],
          },
        ],
      }),
    ];
    expect(unassignedItems(s, AVA, filed)).toHaveLength(0);
  });
});

describe('consolidateDeterministic', () => {
  it('files an item into the strand whose title it shares words with', () => {
    const s = fold([chat(10, 'sunset photos for Leo', 'chat_a')]);
    const current = [
      strand('sunset', 'Ocean Beach sunset', { summary: 'the sunset shots' }),
      strand('groceries', 'Grocery run'),
    ];
    const { strands, folded } = consolidateDeterministic(s, AVA, current);
    expect(folded).toBe(1);
    expect(strands.find((x) => x.id === 'sunset')!.items).toHaveLength(1);
    expect(strands.find((x) => x.id === 'groceries')!.items).toHaveLength(0);
  });

  it('never files new work into a done strand', () => {
    const s = fold([chat(10, 'sunset photos for Leo', 'chat_a')]);
    const current = [
      strand('sunset', 'Ocean Beach sunset', { status: 'done' }),
    ];
    const { strands } = consolidateDeterministic(s, AVA, current);
    expect(strands.find((x) => x.id === 'sunset')!.items).toHaveLength(0);
    expect(strands).toHaveLength(2); // the item started its own strand instead
  });

  it('starts a new strand for activity nothing claims, with a stable id', () => {
    const s = fold([chat(10, 'quarterly budget spreadsheet', 'chat_a')]);
    const current = [strand('sunset', 'Ocean Beach sunset')];
    const a = consolidateDeterministic(s, AVA, current);
    const b = consolidateDeterministic(s, AVA, current);
    const started = a.strands.filter((x) => x.id !== 'sunset');
    expect(started).toHaveLength(1);
    expect(started[0].title).toBe('quarterly budget spreadsheet');
    // Re-running from the same inputs yields the same id, not a fresh uid.
    expect(b.strands.map((x) => x.id)).toEqual(a.strands.map((x) => x.id));
  });

  it('groups loose reminders into one follow-ups strand', () => {
    const s = fold([
      reminder(10, 'rem_1', 'call the plumber'),
      reminder(20, 'rem_2', 'renew the parking permit'),
    ]);
    const { strands } = consolidateDeterministic(s, AVA, []);
    expect(strands).toHaveLength(1);
    expect(strands[0].items).toHaveLength(2);
    expect(strands[0].title).toBe('Follow-ups');
  });

  it('is idempotent — a second pass folds nothing', () => {
    const s = fold([
      chat(10, 'sunset photos for Leo', 'chat_a'),
      reminder(20, 'rem_1', 'call the plumber'),
    ]);
    const first = consolidateDeterministic(s, AVA, [
      strand('sunset', 'Ocean Beach sunset'),
    ]);
    const second = consolidateDeterministic(s, AVA, first.strands);
    expect(second.folded).toBe(0);
    expect(second.reply).toBe('Nothing new to fold in.');
    expect(second.strands).toEqual(first.strands);
  });
});

describe('reconcileStrands — the model-output safety net', () => {
  const current = [
    strand('kept', 'Kept', {
      items: [
        { source: 'seed:kept:0', kind: 'note', at: 1, text: 'original', refs: [] },
      ],
    }),
  ];
  const allowed = new Set(['seed:kept:0', 'chat:chat_a']);

  it('re-attaches an existing strand’s items when the model drops them', () => {
    const out = reconcileStrands([strand('kept', 'Kept')], current, allowed);
    expect(out[0].items.map((i) => i.source)).toEqual(['seed:kept:0']);
  });

  it('brings back a strand the model forgot entirely', () => {
    const out = reconcileStrands([strand('new', 'New')], current, allowed);
    expect(out.map((x) => x.id).sort()).toEqual(['kept', 'new']);
  });

  it('drops invented items and keeps a duplicated source only once', () => {
    const invented = {
      source: 'msg:never-happened',
      kind: 'message' as const,
      at: 5,
      text: 'fabricated',
      refs: [],
    };
    const real = {
      source: 'chat:chat_a',
      kind: 'chat' as const,
      at: 5,
      text: 'real',
      refs: [],
    };
    const out = reconcileStrands(
      [
        strand('kept', 'Kept', { items: [invented, real] }),
        strand('other', 'Other', { items: [real] }),
      ],
      current,
      allowed,
    );
    const sources = out.flatMap((x) => x.items.map((i) => i.source));
    expect(sources).not.toContain('msg:never-happened');
    expect(sources.filter((x) => x === 'chat:chat_a')).toHaveLength(1);
  });

  it('lets the model rename a strand and change its status', () => {
    const out = reconcileStrands(
      [strand('kept', 'Renamed', { status: 'done' })],
      current,
      allowed,
    );
    expect(out[0].title).toBe('Renamed');
    expect(out[0].status).toBe('done');
  });
});

describe('the unwired boundary', () => {
  it('the Threads app declares no actions, so nothing is proposable', () => {
    expect(getApp('threads').actions).toEqual([]);
    expect(listCapabilities().some((c) => c.app === 'threads')).toBe(false);
  });

  it('strands are not part of the context bundle the brain plans from', () => {
    const ctx = assembleContext(session, freshState());
    expect(Object.keys(ctx)).not.toContain('strands');
    expect(Object.keys(ctx.situation)).not.toContain('strands');
  });
});

describe('the mock brain consolidates through the adapter', () => {
  it('folds the log into the seed strands and stays idempotent', async () => {
    const state = fold([chat(10, 'Yosemite prints for the hallway', 'chat_a')]);
    const ctx = assembleContext(session, state);
    const brain = intelligenceFor(AVA);

    const first = await brain.consolidate(ctx, strandsFor(state, AVA));
    const yosemite = first.strands.find((x) => x.id === 'yosemite-prints')!;
    expect(yosemite.items.some((i) => i.source === 'chat:chat_a')).toBe(true);

    const second = await brain.consolidate(ctx, first.strands);
    expect(second.reply).toBe('Nothing new to fold in.');
    expect(second.strands).toEqual(first.strands);
  });
});
