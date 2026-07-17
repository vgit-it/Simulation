import type { ContextBundle } from '../context';
import type { Plan, PlanStep } from '../plans/types';
import { uid } from '../state';
import { contactsOf, resolvePerson, sharedPhotoCount, type Photo } from '../world';
import type {
  ChatReply,
  ChatTurn,
  IntelligenceProvider,
  PersonIntelligence,
  PhotoGroup,
  ResolvedPerson,
  ShareDraft,
  Suggestion,
} from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Deterministic, token-free brain for one person. All answers are computed from
 * committed metadata + the passed-in clock — no perception, no network.
 */
class MockPersonIntelligence implements PersonIntelligence {
  constructor(readonly personId: string) {}

  groupPhotosByTime(photos: Photo[], now: Date): PhotoGroup[] {
    const threshold = now.getTime() - WEEK_MS;
    const thisWeek: Photo[] = [];
    const earlier: Photo[] = [];
    for (const photo of photos) {
      if (photo.date.getTime() >= threshold) thisWeek.push(photo);
      else earlier.push(photo);
    }
    const groups: PhotoGroup[] = [];
    if (thisWeek.length) {
      groups.push({ key: 'this-week', label: 'This Week', photos: thisWeek });
    }
    if (earlier.length) {
      groups.push({ key: 'earlier', label: 'Earlier', photos: earlier });
    }
    return groups;
  }

  peopleInPhoto(photo: Photo): ResolvedPerson[] {
    return photo.people.map((id) => resolvePerson(this.personId, id));
  }

  draftShare(photos: Photo[]): ShareDraft {
    // Recipients = everyone who appears in the photos, minus the owner.
    const ids = new Set<string>();
    for (const photo of photos) {
      for (const id of photo.people) {
        if (id !== this.personId) ids.add(id);
      }
    }
    const recipients = [...ids].map((id) => resolvePerson(this.personId, id));

    const places = [...new Set(photos.map((p) => p.location).filter(Boolean))];
    const placePhrase =
      places.length === 0
        ? ''
        : places.length === 1
          ? ` from ${places[0]}`
          : ` from ${places.slice(0, -1).join(', ')} and ${places.at(-1)}`;
    const count = photos.length;
    const noun = count === 1 ? 'this photo' : `these ${count} photos`;
    const message = `Hey! Sharing ${noun}${placePhrase} — thought you'd want them. 📷`;

    return { recipients, message };
  }

  suggestShares(photos: Photo[], now: Date): Suggestion[] {
    const hasOthers = (p: Photo) => p.people.some((id) => id !== this.personId);
    const groups = this.groupPhotosByTime(photos, now);
    const thisWeek = (groups.find((g) => g.key === 'this-week')?.photos ?? [])
      .filter(hasOthers);

    const suggestions: Suggestion[] = [];

    // Hero suggestion: share this week's photos with the people in them.
    if (thisWeek.length) {
      const draft = this.draftShare(thisWeek);
      suggestions.push({
        id: 'share-this-week',
        intent: 'share-photos',
        title: `Share this week's ${thisWeek.length} photo${
          thisWeek.length === 1 ? '' : 's'
        }`,
        subtitle: draft.recipients.length
          ? `With ${draft.recipients.map((r) => r.name).join(', ')}`
          : '',
        photos: thisWeek,
      });
    }

    // A narrower nudge: the single most recent photo that has other people.
    const latest = [...photos]
      .filter(hasOthers)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    if (latest && thisWeek.length !== 1) {
      const draft = this.draftShare([latest]);
      suggestions.push({
        id: `share-latest-${latest.id}`,
        intent: 'share-photos',
        title: `Share your ${latest.location} photo`,
        subtitle: draft.recipients.length
          ? `With ${draft.recipients.map((r) => r.name).join(', ')}`
          : '',
        photos: [latest],
      });
    }

    return suggestions;
  }

  /**
   * The photos a request refers to: the user's current selection if they've
   * picked any, else this week's shareable set (what `suggestShares` surfaces).
   */
  private requestPhotos(ctx: ContextBundle): Photo[] {
    const sel = ctx.situation.selection;
    if (sel && sel.kind === 'photos' && sel.ids.length) {
      return ctx.owner.gallery.filter((p) => sel.ids.includes(p.id));
    }
    const [top] = this.suggestShares(ctx.owner.gallery, ctx.now);
    return top ? top.photos : [];
  }

  plan(ctx: ContextBundle, request: string): Plan | null {
    const lower = request.toLowerCase();
    const aboutSharing =
      ['share', 'send', 'photo', 'pic'].some((k) => lower.includes(k)) ||
      !!ctx.situation.selection;
    if (!aboutSharing) return null;
    if (!ctx.device.apps.includes('photos')) return null;

    const photos = this.requestPhotos(ctx);
    if (!photos.length) return null;
    const draft = this.draftShare(photos);
    if (!draft.recipients.length) return null; // no one to share with

    const ids = photos.map((p) => p.id);
    const fromSelection =
      ctx.situation.selection?.kind === 'photos' &&
      ctx.situation.selection.ids.length > 0;
    const count = photos.length;
    const noun = `photo${count === 1 ? '' : 's'}`;
    const names = draft.recipients.map((r) => r.name).join(', ');

    const steps: PlanStep[] = [
      {
        id: 'gather',
        app: 'photos',
        description: fromSelection
          ? `Review your ${count} selected ${noun}`
          : `Gather this week's ${count} ${noun}`,
      },
      {
        id: 'share',
        app: 'photos',
        intent: 'share-photos',
        ids,
        description: `Share ${count === 1 ? 'it' : 'them'} with ${names}`,
      },
    ];
    // Only add the confirmation hop if the device actually has Messages.
    if (ctx.device.apps.includes('messages')) {
      steps.push({
        id: 'confirm',
        app: 'messages',
        description: 'Open Messages to confirm the send',
      });
    }

    return {
      id: uid('plan'),
      goal: `Share ${count} ${noun} with ${names}`,
      steps,
    };
  }

  respond(ctx: ContextBundle, history: ChatTurn[], message: string): ChatReply {
    const lower = message.toLowerCase();
    const greeting = history.length === 0 ? 'Hi! ' : '';

    // An imperative, actionable request becomes a runnable plan; an advisory
    // question ("what should I share?") stays a suggestion. The difference is
    // whether the user is telling us to do something or asking what to do.
    const isQuestion =
      lower.trimEnd().endsWith('?') ||
      /\b(what|which|who|how|when|should|do you|can i)\b/.test(lower);
    const imperative = !isQuestion || !!ctx.situation.selection;
    if (imperative) {
      const plan = this.plan(ctx, message);
      if (plan) {
        return {
          text: `${greeting}Here's a ${plan.steps.length}-step plan — review it and I'll run it.`,
          plan,
        };
      }
    }

    if (lower.includes('share') || lower.includes('photo')) {
      const [top] = this.suggestShares(ctx.owner.gallery, ctx.now);
      if (!top) {
        return {
          text: `${greeting}Nothing new to share right now — check back after your next photo.`,
        };
      }
      const sentences = [
        `${top.title}.`,
        top.subtitle ? `${top.subtitle}.` : '',
        'Want me to draft it?',
      ].filter(Boolean);
      return { text: `${greeting}${sentences.join(' ')}` };
    }

    const contact = contactsOf(ctx.owner.id).find(
      (c) =>
        lower.includes(c.name.toLowerCase()) ||
        lower.includes(c.name.split(' ')[0].toLowerCase()),
    );
    if (contact) {
      const count = sharedPhotoCount(ctx.owner.id, contact.id);
      return {
        text: count
          ? `${greeting}You've been in ${count} photo${count === 1 ? '' : 's'} together with ${contact.name}.`
          : `${greeting}I don't see any photos of you with ${contact.name} yet.`,
      };
    }

    return {
      text: `${greeting}I'm a scripted assistant for now — ask me about sharing this week's photos, or who you've been photographed with.`,
    };
  }
}

export class MockIntelligence implements IntelligenceProvider {
  private brains = new Map<string, PersonIntelligence>();

  for(personId: string): PersonIntelligence {
    let brain = this.brains.get(personId);
    if (!brain) {
      brain = new MockPersonIntelligence(personId);
      this.brains.set(personId, brain);
    }
    return brain;
  }
}
