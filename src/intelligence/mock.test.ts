import { describe, expect, it } from 'vitest';
import { assembleContext, type ContextBundle } from '../context';
import type { Plan, PlanStep } from '../plans/types';
import { freshState, type RuntimeState } from '../state';
import { MockIntelligence } from './mock';
import { sharedPhotoCount, type Photo } from '../world';

function photo(id: string, iso: string, people: string[]): Photo {
  return {
    id,
    url: `${id}.svg`,
    date: new Date(iso),
    location: 'Somewhere',
    people,
    tags: [],
  };
}

const now = new Date('2026-07-16T12:00:00');
const brain = new MockIntelligence().for('ava-chen');
const session = { personId: 'ava-chen', deviceId: 'ava-phone' };

/** A context over a fabricated gallery (and optionally pre-seeded state). */
function ctxWith(gallery: Photo[], state?: RuntimeState): ContextBundle {
  const base = assembleContext(session, {
    ...(state ?? freshState()),
    clock: now.getTime(),
  });
  return { ...base, owner: { ...base.owner, gallery } };
}

describe('MockIntelligence', () => {
  it('buckets photos into this-week and earlier', () => {
    const groups = brain.groupPhotosByTime(
      [
        photo('a', '2026-07-15', []), // within a week
        photo('b', '2026-05-01', []), // earlier
      ],
      now,
    );
    expect(groups.map((g) => g.key)).toEqual(['this-week', 'earlier']);
  });

  it('drafts share recipients from photo people, excluding the owner', () => {
    const draft = brain.draftShare([
      photo('a', '2026-07-15', ['ava-chen', 'sam-ruiz']),
    ]);
    expect(draft.recipients.map((r) => r.id)).toEqual(['sam-ruiz']);
    expect(draft.message).toContain('photo');
  });

  it('suggests sharing this week’s photos that include other people', () => {
    const suggestions = brain.suggest(
      ctxWith([
        photo('a', '2026-07-15', ['ava-chen', 'sam-ruiz']), // this week, w/ others
        photo('b', '2026-07-14', ['ava-chen']), // this week, solo -> excluded
        photo('c', '2026-05-01', ['ava-chen', 'maya-osei']), // earlier -> excluded
      ]),
    );
    const week = suggestions.find((s) => s.id === 'share-this-week');
    expect(week).toBeDefined();
    expect(week!.ids).toEqual(['a']);
    expect(week!.intent).toBe('share-photos');
  });

  it('makes no suggestions when nothing recent includes other people', () => {
    const suggestions = brain.suggest(
      ctxWith([photo('a', '2026-07-15', ['ava-chen'])]),
    );
    expect(suggestions).toHaveLength(0);
  });

  it('never re-suggests photos the log shows were already shared', () => {
    const state = freshState();
    const shared: RuntimeState = {
      ...state,
      messages: [
        {
          id: 'm1',
          at: 1,
          from: 'ava-chen',
          to: ['sam-ruiz'],
          body: 'here!',
          attachments: ['a'],
        },
      ],
    };
    const gallery = [
      photo('a', '2026-07-15', ['ava-chen', 'sam-ruiz']), // already shared
      photo('b', '2026-07-14', ['ava-chen', 'maya-osei']), // still fresh
    ];
    const suggestions = brain.suggest(ctxWith(gallery, shared));
    const week = suggestions.find((s) => s.id === 'share-this-week');
    expect(week!.ids).toEqual(['b']);
    // And once everything is shared, the share suggestion disappears.
    const allShared: RuntimeState = {
      ...shared,
      messages: [
        { ...shared.messages[0], attachments: ['a', 'b'] },
      ],
    };
    const none = brain
      .suggest(ctxWith(gallery, allShared))
      .filter((s) => s.intent === 'share-photos');
    expect(none).toHaveLength(0);
  });

  it('suggests replying to an unanswered inbound share (and drops it once replied)', () => {
    const state = freshState();
    const gallery = [photo('a', '2026-07-15', ['ava-chen'])];
    const withInbound: RuntimeState = {
      ...state,
      messages: [
        {
          id: 'in1',
          at: 5,
          from: 'sam-ruiz',
          to: ['ava-chen'],
          body: 'look!',
          attachments: ['sam-1', 'sam-2'],
        },
      ],
    };
    const [reply] = brain.suggest(ctxWith(gallery, withInbound));
    expect(reply).toMatchObject({ intent: 'send-message', ids: ['sam-ruiz'] });
    expect(reply.title).toContain('Sam Ruiz');
    expect(reply.subtitle).toContain('2 photos');

    const replied: RuntimeState = {
      ...withInbound,
      messages: [
        ...withInbound.messages,
        {
          // Same sim tick as the inbound share: the clock only moves when a
          // scenario advances it, so a same-timestamp reply must still count.
          id: 'out1',
          at: 5,
          from: 'ava-chen',
          to: ['sam-ruiz'],
          body: 'love them!',
          attachments: [],
        },
      ],
    };
    const after = brain
      .suggest(ctxWith(gallery, replied))
      .filter((s) => s.intent === 'send-message');
    expect(after).toHaveLength(0);
  });
});

describe('MockIntelligence.respond', () => {
  const ctx = assembleContext(session, freshState(), {});

  it('answers a share-keyword message with the same suggestion suggest() would make', async () => {
    const [top] = brain.suggest(ctx).filter((s) => s.intent === 'share-photos');
    const reply = await brain.respond(ctx, [], 'What should I share this week?');
    expect(reply.text).toContain(top.title);
    expect(reply.text).toContain('Want me to draft it?');
  });

  it('answers a contact-name message with the correct shared-photo count', async () => {
    const reply = await brain.respond(ctx, [], 'Tell me about Sam');
    const count = sharedPhotoCount('ava-chen', 'sam-ruiz');
    expect(reply.text).toContain(`${count} photo`);
    expect(reply.text).toContain('Sam Ruiz');
  });

  it('falls back to a scripted reply for unrelated messages', async () => {
    const reply = await brain.respond(ctx, [], 'What time is it?');
    expect(reply.text).toContain('scripted assistant');
  });

  it('greets only on the first turn', async () => {
    const first = await brain.respond(ctx, [], 'hello');
    const second = await brain.respond(
      ctx,
      [
        { role: 'user', text: 'hi' },
        { role: 'assistant', text: 'Hi!' },
      ],
      'hello again',
    );
    expect(first.text.startsWith('Hi!')).toBe(true);
    expect(second.text.startsWith('Hi!')).toBe(false);
  });
});

describe('MockIntelligence.revisePlan', () => {
  const ctx = assembleContext(session, freshState(), {});

  const shareStep = (recipients: string[]): PlanStep => ({
    id: 'share',
    app: 'photos',
    intent: 'share-photos',
    ids: ['img-004'],
    payload: { recipients },
    description: `Share it with ${recipients.join(', ')}`,
  });
  const messageStep = (recipients: string[]): PlanStep => ({
    id: 'message',
    app: 'messages',
    intent: 'send-message',
    ids: recipients,
    payload: { text: 'hi' },
    description: `Send a message to ${recipients.join(', ')}`,
  });
  const reminderStep: PlanStep = {
    id: 'remind',
    app: 'reminders',
    intent: 'create-reminder',
    ids: [],
    payload: { title: 'buy milk' },
    description: 'Add reminder: "buy milk"',
  };
  const plan = (steps: PlanStep[]): Plan => ({ id: 'p1', goal: 'Test plan', steps });

  it('replaces a share step\'s recipients ("just Sam")', async () => {
    const result = await brain.revisePlan(
      ctx,
      plan([shareStep(['leo-park', 'sam-ruiz'])]),
      'just Sam',
    );
    expect(result.plan?.steps[0].payload?.recipients).toEqual(['sam-ruiz']);
    expect(result.plan?.id).toBe('p1');
    expect(result.reply).toContain('Sam');
  });

  it('adds a recipient to a share step', async () => {
    const result = await brain.revisePlan(
      ctx,
      plan([shareStep(['leo-park'])]),
      'also add Sam',
    );
    expect(result.plan?.steps[0].payload?.recipients).toEqual([
      'leo-park',
      'sam-ruiz',
    ]);
  });

  it('removes a recipient from a share step', async () => {
    const result = await brain.revisePlan(
      ctx,
      plan([shareStep(['leo-park', 'sam-ruiz'])]),
      'remove Leo',
    );
    expect(result.plan?.steps[0].payload?.recipients).toEqual(['sam-ruiz']);
  });

  it('refuses to remove the last recipient', async () => {
    const result = await brain.revisePlan(
      ctx,
      plan([shareStep(['leo-park'])]),
      'remove Leo',
    );
    expect(result.plan).toBeNull();
    expect(result.reply).toContain('no one');
  });

  it("edits a message step's ids (not payload) for recipients", async () => {
    const result = await brain.revisePlan(
      ctx,
      plan([messageStep(['leo-park'])]),
      'just Sam',
    );
    expect(result.plan?.steps[0].ids).toEqual(['sam-ruiz']);
  });

  it('removes a step by keyword, preserving the remaining step\'s id', async () => {
    const result = await brain.revisePlan(
      ctx,
      plan([shareStep(['leo-park']), reminderStep]),
      'skip the reminder',
    );
    expect(result.plan?.steps.map((s) => s.id)).toEqual(['share']);
    expect(result.reply).toContain('Removed');
  });

  it('refuses to remove the only remaining action step', async () => {
    const result = await brain.revisePlan(
      ctx,
      plan([reminderStep]),
      'skip the reminder',
    );
    expect(result.plan).toBeNull();
  });

  it("changes a reminder's title", async () => {
    const result = await brain.revisePlan(
      ctx,
      plan([reminderStep]),
      'change the reminder to buy eggs',
    );
    expect(result.plan?.steps[0].payload?.title).toBe('buy eggs');
  });

  it('preserves untouched step ids across an edit', async () => {
    const result = await brain.revisePlan(
      ctx,
      plan([shareStep(['leo-park']), reminderStep]),
      'just Sam',
    );
    expect(result.plan?.steps[0].id).toBe('share');
    expect(result.plan?.steps[1].id).toBe('remind');
  });

  it('gives an honest reply for an unrecognized edit, leaving the plan untouched', async () => {
    const result = await brain.revisePlan(
      ctx,
      plan([shareStep(['leo-park'])]),
      'make it purple',
    );
    expect(result.plan).toBeNull();
    expect(result.reply).toContain("couldn't apply");
  });
});
