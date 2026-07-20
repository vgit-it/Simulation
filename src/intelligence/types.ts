import type { ContextBundle } from '../context';
import type { Plan } from '../plans/types';
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
 * A proactive thing the assistant offers to do, given the current world. A
 * suggestion is a pre-proposal: tapping it calls `propose(intent, ctx, ids,
 * payload)` — so it carries exactly the propose inputs, whatever the intent.
 */
export interface Suggestion {
  id: string;
  intent: string;
  title: string;
  subtitle: string;
  /** Emoji shown on the suggestion row (defaults per intent in the UI). */
  icon: string;
  /** The object ids to propose over (photo ids, person ids, ...). */
  ids: string[];
  /** Free-form propose payload (message text, ...). */
  payload?: Record<string, unknown>;
}

/** One turn of an open-ended conversation with the assistant. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * The brain's reply to a free-form chat message. `text` is always present; a
 * task-shaped request also yields a `plan` the assistant can preview and run —
 * this is how the chat becomes able to *act*, not just describe. In the LLM
 * dry-run provider, `llmRequest` carries the exact API payload that would have
 * been sent, for the UI to display instead of an answer.
 */
export interface ChatReply {
  text: string;
  plan?: Plan;
  llmRequest?: import('./llm/prompt').LLMRequest;
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
  /** Draft the text of a standalone message to the given recipients. */
  draftMessage(recipients: ResolvedPerson[]): string;
  /**
   * Proactive suggestions given the full situation — the SITUATED entry point:
   * what's shareable that hasn't been shared, inbound shares worth replying
   * to, etc. Reads runtime history through the context, never re-suggesting
   * what the log shows already happened.
   */
  suggest(ctx: ContextBundle): Suggestion[];
  /**
   * Reply to a free-form message in the assistant chat, given the full
   * context bundle (owner/device/state/situation) and the conversation so
   * far. This is the exact seam an LLM-backed brain implements — the mock and
   * dry-run providers resolve synchronously; a real provider (Gemini) awaits
   * the network. Async is the contract so the consumer never has to branch on
   * provider.
   */
  respond(
    ctx: ContextBundle,
    history: ChatTurn[],
    message: string,
  ): Promise<ChatReply>;
  /**
   * Decompose a free-form request into an ordered `Plan` over the capability
   * registry — the runtime equivalent of an authored scenario, generated after
   * the request arrives. Returns `null` when nothing in the request maps to a
   * viable capability. Deterministic in the mock; the LLM-backed brain returns
   * the same shape (tool/capability calls) in M5.
   */
  plan(ctx: ContextBundle, request: string): Plan | null;
}

/**
 * The swappable "intelligence" boundary. `for(personId)` returns that person's
 * brain. Everything the UI treats as a smart/derived result goes through here.
 */
export interface IntelligenceProvider {
  for(personId: string): PersonIntelligence;
}
