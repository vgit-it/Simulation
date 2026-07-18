import type {
  ChatTurnRecord,
  Fact,
  Message,
  PlanRun,
  Reminder,
  RuntimeState,
} from './reducer';

/** A conversation: all messages among the same set of participants. */
export interface Thread {
  key: string;
  /** The other participants (everyone on the thread except the viewer). */
  participantIds: string[];
  /** Messages oldest-first. */
  messages: Message[];
  /** The most recent message (thread preview / sort key). */
  last: Message;
}

export function selectNow(state: RuntimeState): Date {
  return new Date(state.clock);
}

/** Messages sent by a person. */
export function messagesFrom(state: RuntimeState, personId: string): Message[] {
  return state.messages.filter((m) => m.from === personId);
}

/** Every message a person is part of — as sender or recipient (their inbox). */
export function messagesInvolving(
  state: RuntimeState,
  personId: string,
): Message[] {
  return state.messages.filter(
    (m) => m.from === personId || m.to.includes(personId),
  );
}

/** All participants of a message (sender + recipients), deduped and sorted. */
function participantsOf(m: Message): string[] {
  return [...new Set([m.from, ...m.to])].sort();
}

/**
 * Group a person's inbox into threads. A thread is keyed by its full participant
 * set, so a message and any reply collapse into one conversation regardless of
 * direction. Threads are newest-first; messages within a thread are oldest-first.
 */
export function inboxThreads(
  state: RuntimeState,
  personId: string,
): Thread[] {
  const byKey = new Map<string, Message[]>();
  for (const m of messagesInvolving(state, personId)) {
    const key = participantsOf(m).join('+');
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(m);
  }
  const threads: Thread[] = [];
  for (const [key, msgs] of byKey) {
    const messages = [...msgs].sort((a, b) => a.at - b.at);
    threads.push({
      key,
      participantIds: participantsOf(messages[0]).filter(
        (id) => id !== personId,
      ),
      messages,
      last: messages[messages.length - 1],
    });
  }
  return threads.sort((a, b) => b.last.at - a.last.at);
}

/** Messages whose attachments include a given asset/photo id. */
export function messagesWithAttachment(
  state: RuntimeState,
  assetId: string,
): Message[] {
  return state.messages.filter((m) => m.attachments.includes(assetId));
}

export function factsFor(state: RuntimeState, personId: string): Fact[] {
  return state.facts[personId] ?? [];
}

/**
 * The keys of a person's threads whose newest message is inbound and newer
 * than their last ThreadRead of that thread — i.e. what deserves a badge.
 */
export function unreadThreadKeys(
  state: RuntimeState,
  personId: string,
): Set<string> {
  const keys = new Set<string>();
  for (const t of inboxThreads(state, personId)) {
    if (t.last.from === personId) continue; // your own message can't be unread
    const readAt = state.reads[personId]?.[t.key] ?? -1;
    if (t.last.at > readAt) keys.add(t.key);
  }
  return keys;
}

/** How many unread threads a person has (the Messages badge count). */
export function unreadCountFor(state: RuntimeState, personId: string): number {
  return unreadThreadKeys(state, personId).size;
}

/**
 * A person's assistant-chat history (oldest first — conversation order).
 * Scoped to one conversation thread when `session` is given — the fresh-vs-
 * resumed distinction: a newly minted session id matches nothing, so the
 * conversation starts empty.
 */
export function chatHistoryFor(
  state: RuntimeState,
  personId: string,
  session?: string,
): ChatTurnRecord[] {
  const mine = state.chats.filter((c) => c.person === personId);
  if (session === undefined) return mine;
  return mine.filter((c) => (c.session ?? LEGACY_SESSION) === session);
}

/** The bucket for chat turns recorded before threads existed. */
export const LEGACY_SESSION = 'chat-legacy';

/** One assistant conversation: the turns sharing a session id. */
export interface ChatSession {
  id: string;
  /** The conversation's title: its first user message. */
  title: string;
  /** Turns oldest-first. */
  turns: ChatTurnRecord[];
  /** The most recent turn (list preview / sort key). */
  last: ChatTurnRecord;
}

/**
 * A person's assistant conversations, newest-activity first. Every invocation
 * of the assistant outside an existing thread minted a fresh session id, so
 * each request groups into its own thread; pre-thread turns collapse into one
 * legacy conversation.
 */
export function chatSessionsFor(
  state: RuntimeState,
  personId: string,
): ChatSession[] {
  const byId = new Map<string, ChatTurnRecord[]>();
  const lastSeq = new Map<string, number>(); // log recency, the tie-breaker
  chatHistoryFor(state, personId).forEach((turn, i) => {
    const id = turn.session ?? LEGACY_SESSION;
    (byId.get(id) ?? byId.set(id, []).get(id)!).push(turn);
    lastSeq.set(id, i);
  });
  const sessions: ChatSession[] = [];
  for (const [id, turns] of byId) {
    const firstUser = turns.find((t) => t.role === 'user');
    sessions.push({
      id,
      title: firstUser?.text ?? turns[0].text,
      turns,
      last: turns[turns.length - 1],
    });
  }
  // Newest activity first. The sim clock often stands still between requests,
  // so equal timestamps fall back to log order — later in the log is newer.
  return sessions.sort(
    (a, b) =>
      b.last.at - a.last.at || lastSeq.get(b.id)! - lastSeq.get(a.id)!,
  );
}

/** A person's reminders (newest first). */
export function remindersFor(state: RuntimeState, personId: string): Reminder[] {
  return state.reminders
    .filter((r) => r.person === personId)
    .sort((a, b) => b.at - a.at);
}

/** Runtime plans a person has run (newest first). */
export function plansFor(state: RuntimeState, personId: string): PlanRun[] {
  return state.plans
    .filter((p) => p.person === personId)
    .sort((a, b) => b.at - a.at);
}
