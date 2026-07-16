import { describe, expect, it } from 'vitest';
import { MockIntelligence } from './mock';
import type { Photo } from '../world';

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
});
