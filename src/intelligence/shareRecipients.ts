import type { ContextBundle } from '../context';
import { contactsOf, resolvePerson, type ResolvedPerson } from '../world';

/**
 * Who a share should go to, when the REQUEST ITSELF names them: either an
 * explicit people selection (a tapped contact, an open thread) or a contact
 * name mentioned in the request text. Returns null when neither is present, so
 * the caller falls back to `draftShare`'s "everyone tagged in the photo"
 * default — the request's own recipient must never be silently discarded in
 * favor of that default.
 *
 * Shared by BOTH deciders: the mock brain's `plan()` calls it directly, and the
 * Gemini brain applies it as a post-processing safety net over whatever plan
 * the model returns — a model can describe the right person in a step's prose
 * while still omitting `payload.recipients`, and `proposeSharePhotos` silently
 * defaults to everyone tagged when that field is absent. Without this shared
 * check, a model-authored plan text saying "share with Leo" could still commit
 * to everyone in the photo.
 */
export function requestedShareRecipients(
  ctx: ContextBundle,
  request: string,
  personId: string,
): ResolvedPerson[] | null {
  const sel = ctx.situation.selection;
  if (sel?.kind === 'people' && sel.ids.length) {
    return sel.ids.map((id) => resolvePerson(personId, id));
  }
  const named = matchContacts(personId, request);
  return named.length ? named : null;
}

/**
 * Resolve free text to the owner's contacts it names — shared by the request
 * parser above and the `contact` value-kind parser (`src/actions/valueKinds.ts`)
 * that folds an elicit answer. Two passes:
 *  - **substring** on the full or first name ("share with Sam Ruiz" / "with
 *    sam") — the request-text case, unchanged from before.
 *  - **first-name prefix** when the text is a single bare token ("Sa" → Sam;
 *    an ambiguous "j" → every J-name, which the assistant disambiguates).
 * Deterministic; no perception.
 */
export function matchContacts(
  personId: string,
  text: string,
): ResolvedPerson[] {
  const lower = text.toLowerCase().trim();
  if (!lower) return [];
  const contacts = contactsOf(personId);
  const substring = contacts.filter(
    (c) =>
      lower.includes(c.name.toLowerCase()) ||
      lower.includes(c.name.split(' ')[0].toLowerCase()),
  );
  if (substring.length) return substring;
  if (/^[a-z]+$/.test(lower)) {
    return contacts.filter((c) =>
      c.name.split(' ')[0].toLowerCase().startsWith(lower),
    );
  }
  return [];
}
