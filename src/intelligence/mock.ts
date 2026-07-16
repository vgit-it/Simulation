import { resolvePerson, type Photo } from '../world';
import type {
  IntelligenceProvider,
  PersonIntelligence,
  PhotoGroup,
  ResolvedPerson,
  ShareDraft,
} from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Deterministic, token-free brain for one person. All answers are computed from
 * committed metadata + the passed-in clock — no perception, no network.
 */
class MockPersonIntelligence implements PersonIntelligence {
  constructor(readonly personId: string) {}

  groupPhotosByTime(photos: Photo[], now: Date): PhotoGroup[] {
    const threshold = now.getTime() - WEEK_MS;
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

  peopleInPhoto(photo: Photo): ResolvedPerson[] {
    return photo.people.map((id) => resolvePerson(this.personId, id));
  }

  draftShare(photos: Photo[]): ShareDraft {
    // Recipients = everyone who appears in the photos, minus the owner.
    const ids = new Set<string>();
    for (const photo of photos) {
      for (const id of photo.people) {
        if (id !== this.personId) ids.add(id);
      }
    }
    const recipients = [...ids].map((id) => resolvePerson(this.personId, id));

    const places = [...new Set(photos.map((p) => p.location).filter(Boolean))];
    const placePhrase =
      places.length === 0
        ? ''
        : places.length === 1
          ? ` from ${places[0]}`
          : ` from ${places.slice(0, -1).join(', ')} and ${places.at(-1)}`;
    const count = photos.length;
    const noun = count === 1 ? 'this photo' : `these ${count} photos`;
    const message = `Hey! Sharing ${noun}${placePhrase} — thought you'd want them. 📷`;

    return { recipients, message };
  }
}

export class MockIntelligence implements IntelligenceProvider {
  private brains = new Map<string, PersonIntelligence>();

  for(personId: string): PersonIntelligence {
    let brain = this.brains.get(personId);
    if (!brain) {
      brain = new MockPersonIntelligence(personId);
      this.brains.set(personId, brain);
    }
    return brain;
  }
}
