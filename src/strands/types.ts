/**
 * Strands: threads of what a person is TRYING TO DO — the first durable unit
 * above a single request.
 *
 * Everything else in this world is single-sitting: a `Plan` is one request, a
 * `ChatSession` is one conversation, a `Reminder` is a flat leaf, and a
 * `ResolveState` (src/tasks) dies with the turn that created it. A Strand is
 * the long-lived thing those all happen *inside* — "the kitchen renovation",
 * "the Lisbon trip" — carrying a status and the items that belong to it.
 *
 * NAMING: the code type is `Strand`; every user-facing label reads "Threads".
 * `Thread` is already two other things here — the message-inbox grouping
 * (`src/state/selectors.ts`) and an assistant `ChatSession` — so the code word
 * is deliberately different from the UI word.
 */

/** The kinds of activity a strand can gather. */
export type StrandItemKind =
  | 'note'
  | 'chat'
  | 'plan'
  | 'message'
  | 'reminder'
  | 'photo';

export type StrandStatus = 'active' | 'dormant' | 'done';

export interface StrandItem {
  /**
   * Stable dedupe key identifying where this item came from:
   * `seed:<strand>:<i>` (authored) | `chat:<session>` | `plan:<planId>` |
   * `msg:<messageId>` | `rem:<reminderId>`.
   *
   * This is what makes consolidation idempotent — an item whose source is
   * already present in ANY strand is never folded in a second time, so
   * pressing the button repeatedly is a no-op. Same id-prefixing convention
   * `notificationsFor` uses for its cross-source feed.
   */
  source: string;
  kind: StrandItemKind;
  /** Sim epoch ms — authored items default to SIM_START. */
  at: number;
  text: string;
  /** Ids this item points at: photo ids, person ids. */
  refs: string[];
}

export interface Strand {
  id: string;
  title: string;
  summary: string;
  status: StrandStatus;
  /** Emoji shown on the strand's card. */
  icon: string;
  /** Oldest first. */
  items: StrandItem[];
}
