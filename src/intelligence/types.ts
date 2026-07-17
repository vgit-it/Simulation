import type { ContextBundle } from '../context';
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

/** A proactive thing the assistant offers to do, given the current world. */
export interface Suggestion {
  id: string;
  intent: string;
  title: string;
  subtitle: string;
  photos: Photo[];
}

/** One turn of an open-ended conversation with the assistant. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** The brain's reply to a free-form chat message. */
export interface ChatReply {
  text: string;
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
  /** Proactive suggestions given the person's gallery and the current time. */
  suggestShares(photos: Photo[], now: Date): Suggestion[];
  /**
   * Reply to a free-form message in the assistant chat, given the full
   * context bundle (owner/device/state/situation) and the conversation so
   * far. This is the exact seam an LLM-backed brain will implement in M5 —
   * `ContextBundle`'s own doc comment calls it out as "the bundle an LLM
   * decider would receive later."
   */
  respond(ctx: ContextBundle, history: ChatTurn[], message: string): ChatReply;
}

/**
 * The swappable "intelligence" boundary. `for(personId)` returns that person's
 * brain. Everything the UI treats as a smart/derived result goes through here.
 */
export interface IntelligenceProvider {
  for(personId: string): PersonIntelligence;
}
