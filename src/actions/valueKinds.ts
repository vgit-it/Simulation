import type { ContextBundle } from '../context';
import { matchContacts } from '../intelligence/shareRecipients';
import type { ActionPayload } from './capabilities';
import { absorbAnswer, candidate, type Candidate, type Slot } from './requirements';

/**
 * Value kinds: the natural-language answer channel of an elicit. A slot declares
 * a `valueKind` (contact / text / …) in its world file; that kind has a
 * deterministic PARSER here (the NL channel) and, in the UI, a PICKER
 * (`src/assistant/pickers`) — one question, two answer channels, both producing
 * a `Candidate`. A parser returns MANY candidates when the answer is ambiguous
 * ("j" → Jamie? Jordan?), which the assistant surfaces as a disambiguation.
 *
 * Adding a value kind = a parser entry here + a picker in the registry + the
 * `valueKind:` on the slot — the same additive shape as the capability and app
 * registries. Pure and offline (principle 8): parsing reuses `matchContacts`.
 */
export interface ParseInput {
  answer: string;
  ctx: ContextBundle;
  ownerId: string;
  slot: Slot;
}
export type ValueKindParser = (input: ParseInput) => Candidate[];

/**
 * contact: resolve names to the owner's contacts. A single bare token matching
 * several people is AMBIGUOUS → one candidate per alternative (to disambiguate);
 * anything else (a full name, a multi-name "Sam and Leo") is a named recipient
 * SET → one candidate whose value is the id array.
 */
function parseContacts({ answer, ownerId }: ParseInput): Candidate[] {
  const matches = matchContacts(ownerId, answer);
  if (!matches.length) return [];
  const singleToken = /^[a-z]+$/.test(answer.toLowerCase().trim());
  if (singleToken && matches.length > 1) {
    return matches.map((m) => candidate([m.id], 'high', 'answer'));
  }
  return [candidate(matches.map((m) => m.id), 'high', 'answer')];
}

/** text: the trimmed answer, verbatim. */
function parseText({ answer }: ParseInput): Candidate[] {
  const t = answer.trim();
  return t ? [candidate(t, 'high', 'answer')] : [];
}

const parsers: Record<string, ValueKindParser> = {
  contact: parseContacts,
  text: parseText,
};

export function valueKindParser(valueKind?: string): ValueKindParser | null {
  return valueKind ? parsers[valueKind] ?? null : null;
}

/**
 * Parse a user's free-text answer for a slot into candidate(s): the slot's
 * value-kind parser when it has one (one candidate → bind; many → disambiguate),
 * else the capability resolver / verbatim fallback (via `absorbAnswer`, wrapped
 * as a single candidate). Empty = couldn't make sense of it → the assistant
 * re-asks.
 */
export function parseSlotAnswer(
  intent: string,
  slot: Slot,
  answer: string,
  ctx: ContextBundle,
  ids: string[],
  payload: ActionPayload,
): Candidate[] {
  const parser = valueKindParser(slot.valueKind);
  if (parser) return parser({ answer, ctx, ownerId: ctx.owner.id, slot });
  const after = absorbAnswer(intent, slot, answer, ctx, ids, payload);
  if (after === payload) return [];
  return [candidate(after[slot.key], 'high', 'answer')];
}
