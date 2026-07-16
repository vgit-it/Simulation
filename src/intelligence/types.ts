import type { Photo } from '../world';

export interface ResolvedPerson {
  id: string;
  name: string;
  avatar: string;
}

export interface PhotoGroup {
  key: string;
  label: string;
  photos: Photo[];
}

/** A drafted share proposal payload (recipients + message body). */
export interface ShareDraft {
  recipients: ResolvedPerson[];
  message: string;
}

/**
 * One person's "brain": the shared intelligence for a person, used across all of
 * that person's devices. Deterministic in the mock; an LLM-backed brain later
 * implements the same surface. Methods that need time take `now` explicitly so
 * the brain stays a pure, testable function of its inputs.
 */
export interface PersonIntelligence {
  readonly personId: string;
  /** Bucket a gallery into human-friendly time groups (newest first). */
  groupPhotosByTime(photos: Photo[], now: Date): PhotoGroup[];
  /** Resolve the people who appear in a photo to display records. */
  peopleInPhoto(photo: Photo): ResolvedPerson[];
  /** Draft who to share the given photos with, and a message to send. */
  draftShare(photos: Photo[]): ShareDraft;
}

/**
 * The swappable "intelligence" boundary. `for(personId)` returns that person's
 * brain. Everything the UI treats as a smart/derived result goes through here.
 */
export interface IntelligenceProvider {
  for(personId: string): PersonIntelligence;
}
