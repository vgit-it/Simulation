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

/**
 * The swappable "intelligence" boundary. Everything the UI treats as a smart /
 * derived result goes through this interface. The M1 MockIntelligence answers
 * deterministically from metadata; an LLM-backed provider can implement the same
 * interface later without any UI changes.
 */
export interface IntelligenceProvider {
  /** Bucket a gallery into human-friendly time groups (newest first). */
  groupPhotosByTime(photos: Photo[]): PhotoGroup[];

  /** Resolve the people who appear in a photo to display records. */
  peopleInPhoto(ownerId: string, photo: Photo): ResolvedPerson[];
}
