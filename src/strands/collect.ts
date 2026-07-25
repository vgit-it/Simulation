import {
  chatSessionsFor,
  messagesFrom,
  plansFor,
  remindersFor,
  type RuntimeState,
} from '../state';
import { resolvePerson } from '../world';
import { assignedSources } from './index';
import type { Strand, StrandItem } from './types';

/**
 * Turning the event log into strand-shaped candidate items.
 *
 * This is the pure, provider-agnostic half of consolidation: WHAT happened.
 * Deciding which strand each item belongs to is the brain's job — the mock
 * does it with keyword overlap, Gemini with a model call — but both start
 * from the same list, so a provider swap never changes what's on the table.
 */

/**
 * A candidate item plus the grouping it falls back to. If no existing strand
 * claims it, items sharing a `groupKey` become one new strand together.
 */
export interface CandidateItem extends StrandItem {
  groupKey: string;
  groupTitle: string;
  groupIcon: string;
}

/**
 * Everything in this person's log that could belong to a strand — their
 * assistant conversations, plan runs, sent messages, and reminders. Oldest
 * first. The `source` prefixes (`chat:`/`plan:`/`msg:`/`rem:`) mirror the
 * id-prefixing convention `notificationsFor` uses for its cross-source feed.
 */
export function collectItems(
  state: RuntimeState,
  personId: string,
): CandidateItem[] {
  const items: CandidateItem[] = [];

  for (const session of chatSessionsFor(state, personId)) {
    items.push({
      source: `chat:${session.id}`,
      kind: 'chat',
      at: session.last.at,
      text: session.title,
      refs: [],
      groupKey: `chat-${session.id}`,
      groupTitle: session.title,
      groupIcon: '✨',
    });
  }

  for (const run of plansFor(state, personId)) {
    items.push({
      source: `plan:${run.planId}`,
      kind: 'plan',
      at: run.at,
      text: run.goal,
      refs: [],
      groupKey: `plan-${run.planId}`,
      groupTitle: run.goal,
      groupIcon: '🗂️',
    });
  }

  for (const message of messagesFrom(state, personId)) {
    const to = [...message.to].sort();
    const names = to.map((id) => resolvePerson(personId, id).name).join(', ');
    items.push({
      source: `msg:${message.id}`,
      kind: 'message',
      at: message.at,
      text: message.body,
      refs: message.attachments,
      // Everything sent to the same set of people gathers into one strand.
      groupKey: `with-${to.join('-')}`,
      groupTitle: `Messages with ${names}`,
      groupIcon: '💬',
    });
  }

  for (const reminder of remindersFor(state, personId)) {
    items.push({
      source: `rem:${reminder.id}`,
      kind: 'reminder',
      at: reminder.at,
      text: reminder.title,
      refs: reminder.related,
      // Loose reminders collect together rather than each spawning a strand.
      groupKey: 'follow-ups',
      groupTitle: 'Follow-ups',
      groupIcon: '⏰',
    });
  }

  return items.sort((a, b) => a.at - b.at);
}

/**
 * The candidate items no strand has claimed yet — the ONLY things a
 * consolidation run may fold in. This is what makes the operation idempotent:
 * once an item's `source` is in the set, every later run skips it.
 */
export function unassignedItems(
  state: RuntimeState,
  personId: string,
  current: Strand[],
): CandidateItem[] {
  const taken = assignedSources(current);
  return collectItems(state, personId).filter((i) => !taken.has(i.source));
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'they', 'them', 'their',
  'you', 'your', 'was', 'were', 'been', 'being', 'are', 'has', 'have', 'had',
  'not', 'but', 'all', 'any', 'some', 'just', 'got', 'get', 'new', 'one', 'two',
  'still', 'now', 'then', 'than', 'over', 'before', 'after', 'again', 'more',
  'most', 'very', 'can', 'will', 'would', 'should', 'could', 'does', 'did',
  'what', 'when', 'where', 'who', 'how', 'why', 'out', 'off', 'its', 'his',
  'her', 'our', 'about', 'into', 'send', 'sent', 'want', 'wants', 'make',
  'made', 'take', 'took', 'said', 'says', 'ask', 'asked', 'need', 'needs',
]);

/** Content words of a phrase — lowercase, 3+ letters, stopwords dropped. */
export function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );
}

/**
 * How strongly an item belongs to a strand: how many content words its text
 * shares with the strand's title + summary. Zero means "no evidence" — the
 * item stays unassigned rather than being forced somewhere.
 */
export function affinity(item: StrandItem, strand: Strand): number {
  const strandWords = keywords(`${strand.title} ${strand.summary}`);
  let score = 0;
  for (const word of keywords(item.text)) {
    if (strandWords.has(word)) score += 1;
  }
  // A photo an item references and the strand already holds is strong evidence
  // even when the wording differs entirely.
  const strandRefs = new Set(strand.items.flatMap((i) => i.refs));
  for (const ref of item.refs) {
    if (strandRefs.has(ref)) score += 2;
  }
  return score;
}
