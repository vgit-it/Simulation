import { describe, expect, it } from 'vitest';
import {
  contactsOf,
  resolveAsset,
  sharedPhotoCount,
  sharedPhotos,
  world,
} from './index';

describe('contacts graph', () => {
  it("derives Ava's contacts from who she co-appears with", () => {
    const ids = contactsOf('ava-chen').map((c) => c.id);
    // Ava's gallery features Sam, Maya and Leo across her photos.
    expect(new Set(ids)).toEqual(new Set(['sam-ruiz', 'maya-osei', 'leo-park']));
  });

  it('excludes the owner and resolves to real people', () => {
    const contacts = contactsOf('ava-chen');
    expect(contacts.every((c) => c.id !== 'ava-chen')).toBe(true);
    for (const c of contacts) {
      expect(world.people[c.id]).toBeDefined();
      expect(c.name).toBe(world.people[c.id].name);
    }
  });

  it('is bidirectional — a new resident who co-appears is a contact both ways', () => {
    // Theo and Sam share a Baker Beach photo in each of their galleries.
    expect(contactsOf('theo-benoit').map((c) => c.id)).toContain('sam-ruiz');
    expect(contactsOf('sam-ruiz').map((c) => c.id)).toContain('theo-benoit');
  });

  it('lists the shared photos themselves, consistently with the count', () => {
    const photos = sharedPhotos('ava-chen', 'sam-ruiz');
    expect(photos.length).toBe(sharedPhotoCount('ava-chen', 'sam-ruiz'));
    expect(photos.every((p) => p.people.includes('sam-ruiz'))).toBe(true);
  });

  it('counts shared photos and resolves assets within a sender gallery', () => {
    expect(sharedPhotoCount('ava-chen', 'sam-ruiz')).toBeGreaterThan(0);
    const asset = resolveAsset('ava-chen', 'img-001');
    expect(asset?.location).toBe('Dolores Park');
    // Same basename, different owner -> different asset (no global ids needed).
    expect(resolveAsset('sam-ruiz', 'img-001')?.location).toBe('Ocean Beach');
  });
});
