import type { RuntimeState } from '../state';
import { affinity, unassignedItems, type CandidateItem } from './collect';
import type { Strand, StrandItem } from './types';

/**
 * The deterministic consolidation pass: fold unassigned activity into the
 * strands it belongs to. This is the mock brain's whole implementation, and
 * also Gemini's fallback when a reply can't be parsed — so the button always
 * does something sensible, offline and token-free (principle 8).
 */

export interface ConsolidationResult {
  reply: string;
  strands: Strand[];
  /** How many new items were folded in. */
  folded: number;
}

/** `chat-chat_a1b2_3` -> `strand-chat-chat-a1b2-3` */
function strandId(groupKey: string): string {
  return `strand-${groupKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function withItems(strand: Strand, added: StrandItem[]): Strand {
  if (added.length === 0) return strand;
  return {
    ...strand,
    items: [...strand.items, ...added].sort((a, b) => a.at - b.at),
  };
}

/** Strip the grouping hints — a stored item is a plain `StrandItem`. */
function plain(item: CandidateItem): StrandItem {
  return {
    source: item.source,
    kind: item.kind,
    at: item.at,
    text: item.text,
    refs: item.refs,
  };
}

export function consolidateDeterministic(
  state: RuntimeState,
  personId: string,
  current: Strand[],
): ConsolidationResult {
  const pending = unassignedItems(state, personId, current);
  if (pending.length === 0) {
    return { reply: 'Nothing new to fold in.', strands: current, folded: 0 };
  }

  // 1. Claim what an existing strand has evidence for.
  const claimed = new Map<string, StrandItem[]>();
  const leftover: CandidateItem[] = [];
  for (const item of pending) {
    let best: Strand | null = null;
    let bestScore = 0;
    for (const strand of current) {
      // A finished strand doesn't accrete new work.
      if (strand.status === 'done') continue;
      const score = affinity(item, strand);
      if (score > bestScore) {
        best = strand;
        bestScore = score;
      }
    }
    if (best) {
      const list = claimed.get(best.id) ?? [];
      list.push(plain(item));
      claimed.set(best.id, list);
    } else {
      leftover.push(item);
    }
  }

  // 2. Whatever nothing claimed starts a strand of its own, grouped so that
  //    (say) three messages to the same people become ONE new thread.
  const groups = new Map<string, CandidateItem[]>();
  for (const item of leftover) {
    const list = groups.get(item.groupKey) ?? [];
    list.push(item);
    groups.set(item.groupKey, list);
  }

  const existingIds = new Set(current.map((s) => s.id));
  const started: Strand[] = [];
  for (const [groupKey, items] of groups) {
    const id = strandId(groupKey);
    if (existingIds.has(id)) {
      // Deterministic ids collide only with a strand this same pass created
      // earlier; fold into it rather than duplicating.
      const list = claimed.get(id) ?? [];
      list.push(...items.map(plain));
      claimed.set(id, list);
      continue;
    }
    existingIds.add(id);
    started.push({
      id,
      title: items[0].groupTitle,
      summary: '',
      status: 'active',
      icon: items[0].groupIcon,
      items: items.map(plain).sort((a, b) => a.at - b.at),
    });
  }

  const strands = [
    ...current.map((s) => withItems(s, claimed.get(s.id) ?? [])),
    ...started.map((s) => withItems(s, claimed.get(s.id) ?? [])),
  ];

  const intoExisting = [...claimed.entries()].filter(([id]) =>
    current.some((s) => s.id === id),
  ).length;

  const plural = (n: number, one: string, many = `${one}s`) =>
    `${n} ${n === 1 ? one : many}`;
  const items = plural(pending.length, 'new item');
  const existing = plural(intoExisting, 'existing thread');

  let reply: string;
  if (intoExisting > 0 && started.length > 0) {
    reply = `Folded ${items} into ${existing}, and started ${plural(started.length, 'new one', 'new ones')}.`;
  } else if (intoExisting > 0) {
    reply = `Folded ${items} into ${existing}.`;
  } else {
    reply = `Started ${plural(started.length, 'new thread')} from ${items}.`;
  }

  return { reply, strands, folded: pending.length };
}

/**
 * Safety net over a MODEL-authored strand set (the same role
 * `withRequestedShareRecipients` plays for model-authored plans): a capable
 * model still drops threads it was told to echo back, reuses a `source` in two
 * places, or invents an item that never happened. Consolidation is supposed to
 * be a lossless re-description of the log, so reconcile the proposal against
 * what we actually know:
 *
 *  - an item whose `source` isn't a real one is DROPPED (nothing invented);
 *  - a `source` appearing twice is kept only the first time (no duplicates,
 *    and the dedupe key stays trustworthy for the next run);
 *  - an existing strand's own items are re-attached first, so the model can
 *    ADD to a thread but never quietly erase its history;
 *  - a strand the model forgot entirely comes back.
 *
 * Everything else — titles, summaries, status, icons, and which strand an item
 * lands in — is the model's call, which is the whole point of asking it.
 */
export function reconcileStrands(
  proposed: Strand[],
  current: Strand[],
  allowed: Set<string>,
): Strand[] {
  const currentById = new Map(current.map((s) => [s.id, s]));
  const usedSources = new Set<string>();
  const seenIds = new Set<string>();
  const out: Strand[] = [];

  const take = (items: StrandItem[]): StrandItem[] => {
    const kept: StrandItem[] = [];
    for (const item of items) {
      if (!allowed.has(item.source) || usedSources.has(item.source)) continue;
      usedSources.add(item.source);
      kept.push(item);
    }
    return kept;
  };

  for (const p of proposed) {
    if (seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    const base = currentById.get(p.id);
    const items = [...take(base?.items ?? []), ...take(p.items)];
    out.push({
      id: p.id,
      title: p.title,
      summary: p.summary,
      status: p.status,
      icon: p.icon,
      items: items.sort((a, b) => a.at - b.at),
    });
  }

  for (const c of current) {
    if (seenIds.has(c.id)) continue;
    seenIds.add(c.id);
    out.push({ ...c, items: take(c.items) });
  }

  return out;
}
