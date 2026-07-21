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
  const lower = request.toLowerCase();
  const named = contactsOf(personId).filter(
    (c) =>
      lower.includes(c.name.toLowerCase()) ||
      lower.includes(c.name.split(' ')[0].toLowerCase()),
  );
  return named.length ? named : null;
}
