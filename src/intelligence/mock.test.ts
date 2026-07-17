import { describe, expect, it } from 'vitest';
import { assembleContext } from '../context';
import { freshState } from '../state/reducer';
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
    const suggestions = brain.suggestShares(
      [
        photo('a', '2026-07-15', ['ava-chen', 'sam-ruiz']), // this week, w/ others
        photo('b', '2026-07-14', ['ava-chen']), // this week, solo -> excluded
        photo('c', '2026-05-01', ['ava-chen', 'maya-osei']), // earlier -> excluded
      ],
      now,
    );
    const week = suggestions.find((s) => s.id === 'share-this-week');
    expect(week).toBeDefined();
    expect(week!.photos.map((p) => p.id)).toEqual(['a']);
    expect(week!.intent).toBe('share-photos');
  });

  it('makes no suggestions when nothing recent includes other people', () => {
    const suggestions = brain.suggestShares(
      [photo('a', '2026-07-15', ['ava-chen'])],
      now,
    );
    expect(suggestions).toHaveLength(0);
  });
});

describe('MockIntelligence.respond', () => {
  const session = { personId: 'ava-chen', deviceId: 'ava-phone' };
  const ctx = assembleContext(session, freshState(), {});

  it('answers a share-keyword message with the same suggestion suggestShares would make', () => {
    const [top] = brain.suggestShares(ctx.owner.gallery, ctx.now);
    const reply = brain.respond(ctx, [], 'What should I share this week?');
    expect(reply.text).toContain(top.title);
    expect(reply.text).toContain('Want me to draft it?');
  });

  it('answers a contact-name message with the correct shared-photo count', () => {
    const reply = brain.respond(ctx, [], 'Tell me about Sam');
    const count = sharedPhotoCount('ava-chen', 'sam-ruiz');
    expect(reply.text).toContain(`${count} photo`);
    expect(reply.text).toContain('Sam Ruiz');
  });

  it('falls back to a scripted reply for unrelated messages', () => {
    const reply = brain.respond(ctx, [], 'What time is it?');
    expect(reply.text).toContain('scripted assistant');
  });

  it('greets only on the first turn', () => {
    const first = brain.respond(ctx, [], 'hello');
    const second = brain.respond(
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
