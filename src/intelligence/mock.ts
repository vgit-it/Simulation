import { resolvePerson, type Photo } from '../world';
import type { IntelligenceProvider, PhotoGroup, ResolvedPerson } from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Deterministic, token-free intelligence. All answers are computed from the
 * committed metadata against the simulation clock — no perception, no network.
 */
export class MockIntelligence implements IntelligenceProvider {
  constructor(private readonly now: Date) {}

  groupPhotosByTime(photos: Photo[]): PhotoGroup[] {
    const threshold = this.now.getTime() - WEEK_MS;
    const thisWeek: Photo[] = [];
    const earlier: Photo[] = [];
    for (const photo of photos) {
      if (photo.date.getTime() >= threshold) thisWeek.push(photo);
      else earlier.push(photo);
    }
    const groups: PhotoGroup[] = [];
    if (thisWeek.length) {
      groups.push({ key: 'this-week', label: 'This Week', photos: thisWeek });
    }
    if (earlier.length) {
      groups.push({ key: 'earlier', label: 'Earlier', photos: earlier });
    }
    return groups;
  }

  peopleInPhoto(ownerId: string, photo: Photo): ResolvedPerson[] {
    return photo.people.map((id) => resolvePerson(ownerId, id));
  }
}
