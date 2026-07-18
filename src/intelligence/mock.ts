import type { ContextBundle } from '../context';
import type { Plan, PlanStep } from '../plans/types';
import {
  factsFor,
  messagesFrom,
  uid,
  type Message,
  type RuntimeState,
} from '../state';
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
 * committed metadata + the passed-in context — no perception, no network. The
 * brain is SITUATED: it reads runtime history (what's been shared, what
 * arrived, what it recorded) through the context's state, so it never
 * re-suggests what the log shows already happened.
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

  draftMessage(recipients: ResolvedPerson[]): string {
    if (!recipients.length) return 'Hey!';
    const first = recipients[0].name.split(' ')[0];
    return recipients.length === 1
      ? `Hey ${first}! Just wanted to say hi — let's catch up soon. 😊`
      : `Hey everyone! Just wanted to say hi — let's catch up soon. 😊`;
  }

  /** Photo ids this person has already sent (any intent) — never re-suggest. */
  private sharedPhotoIds(state: RuntimeState): Set<string> {
    const out = new Set<string>();
    for (const m of messagesFrom(state, this.personId)) {
      for (const id of m.attachments) out.add(id);
    }
    return out;
  }

  /** This week's photos that include other people and haven't been shared yet. */
  private shareablePhotos(ctx: ContextBundle): Photo[] {
    const shared = this.sharedPhotoIds(ctx.state);
    const groups = this.groupPhotosByTime(ctx.owner.gallery, ctx.now);
    return (groups.find((g) => g.key === 'this-week')?.photos ?? []).filter(
      (p) =>
        p.people.some((id) => id !== this.personId) && !shared.has(p.id),
    );
  }

  /** The newest inbound share this person hasn't replied to yet, if any. */
  private unansweredInboundShare(state: RuntimeState): Message | undefined {
    const inbound = state.messages
      .filter(
        (m) =>
          m.from !== this.personId &&
          m.to.includes(this.personId) &&
          m.attachments.length > 0,
      )
      .sort((a, b) => b.at - a.at)[0];
    if (!inbound) return undefined;
    // `>=`, not `>`: the sim clock only moves when a scenario/dev control
    // advances it, so a reply sent moments later carries the SAME sim
    // timestamp as the share it answers.
    const replied = state.messages.some(
      (m) =>
        m.from === this.personId &&
        m.at >= inbound.at &&
        m.to.includes(inbound.from),
    );
    return replied ? undefined : inbound;
  }

  suggest(ctx: ContextBundle): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // React to the world: an inbound share deserves a reply.
    const inbound = this.unansweredInboundShare(ctx.state);
    if (inbound) {
      const sender = resolvePerson(this.personId, inbound.from);
      const others = [...new Set([inbound.from, ...inbound.to])].filter(
        (id) => id !== this.personId,
      );
      const count = inbound.attachments.length;
      suggestions.push({
        id: `reply-${inbound.id}`,
        intent: 'send-message',
        icon: '💬',
        title: `Reply to ${sender.name}`,
        subtitle: `Sent you ${count} photo${count === 1 ? '' : 's'}`,
        ids: others,
        payload: {
          text: `Love these — thanks for sharing, ${sender.name.split(' ')[0]}! 😍`,
        },
      });
    }

    // Hero suggestion: share this week's not-yet-shared photos.
    const thisWeek = this.shareablePhotos(ctx);
    if (thisWeek.length) {
      const draft = this.draftShare(thisWeek);
      suggestions.push({
        id: 'share-this-week',
        intent: 'share-photos',
        icon: '📷',
        title: `Share this week's ${thisWeek.length} photo${
          thisWeek.length === 1 ? '' : 's'
        }`,
        subtitle: draft.recipients.length
          ? `With ${draft.recipients.map((r) => r.name).join(', ')}`
          : '',
        ids: thisWeek.map((p) => p.id),
      });
    }

    // A narrower nudge: the single most recent unshared photo with others.
    const shared = this.sharedPhotoIds(ctx.state);
    const latest = [...ctx.owner.gallery]
      .filter(
        (p) =>
          p.people.some((id) => id !== this.personId) && !shared.has(p.id),
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    if (latest && thisWeek.length !== 1) {
      const draft = this.draftShare([latest]);
      suggestions.push({
        id: `share-latest-${latest.id}`,
        intent: 'share-photos',
        icon: '📷',
        title: `Share your ${latest.location} photo`,
        subtitle: draft.recipients.length
          ? `With ${draft.recipients.map((r) => r.name).join(', ')}`
          : '',
        ids: [latest.id],
      });
    }

    return suggestions;
  }

  /**
   * The photos a request refers to: the user's current selection if they've
   * picked any, else this week's not-yet-shared set (what `suggest` surfaces).
   */
  private requestPhotos(ctx: ContextBundle): Photo[] {
    const sel = ctx.situation.selection;
    if (sel && sel.kind === 'photos' && sel.ids.length) {
      return ctx.owner.gallery.filter((p) => sel.ids.includes(p.id));
    }
    return this.shareablePhotos(ctx);
  }

  /** Who this person shared with most recently (the recorded fact, read back). */
  private lastSharedWith(ctx: ContextBundle): string[] {
    const facts = factsFor(ctx.state, this.personId).filter(
      (f) => f.key === 'last-shared-with',
    );
    const last = facts[facts.length - 1];
    return last ? [last.value] : [];
  }

  /**
   * Compose a plan from up to three capability families, keyed on the request
   * keywords + the current selection kind:
   *  - share-photos  (photo keywords, or a photos selection)
   *  - send-message  (message keywords, or a people selection — a thread's
   *    participants or a tapped contact — falling back to share recipients,
   *    then to the last-shared-with fact)
   *  - create-reminder (remind keywords; title extracted from "remind me to …")
   * Steps are gated on the app being installed on the embodied device, so the
   * plan never contains a capability the device can't perform.
   */
  plan(ctx: ContextBundle, request: string): Plan | null {
    const lower = request.toLowerCase();
    const sel = ctx.situation.selection;
    const apps = ctx.device.apps;
    const steps: PlanStep[] = [];
    const goalBits: string[] = [];

    const peopleSelected =
      sel?.kind === 'people' && sel.ids.length ? sel.ids : null;
    const wantsShare =
      /share|photo|pic/.test(lower) || sel?.kind === 'photos';
    const wantsMessage =
      /\b(message|tell|text|reply|say|write)\b/.test(lower) ||
      (!!peopleSelected && !wantsShare);
    const wantsReminder = /remind|forget|to-?do/.test(lower);

    // Share: gather (navigate) + share (action) in Photos.
    let sharePhotos: Photo[] = [];
    let shareRecipients: ResolvedPerson[] = [];
    if (wantsShare && apps.includes('photos')) {
      sharePhotos = this.requestPhotos(ctx);
      const draft = sharePhotos.length ? this.draftShare(sharePhotos) : null;
      if (draft?.recipients.length) {
        shareRecipients = draft.recipients;
        const fromSelection = sel?.kind === 'photos' && sel.ids.length > 0;
        const count = sharePhotos.length;
        const noun = `photo${count === 1 ? '' : 's'}`;
        const names = shareRecipients.map((r) => r.name).join(', ');
        steps.push(
          {
            id: 'gather',
            app: 'photos',
            description: fromSelection
              ? `Review your ${count} selected ${noun}`
              : `Gather this week's ${count} unshared ${noun}`,
          },
          {
            id: 'share',
            app: 'photos',
            intent: 'share-photos',
            ids: sharePhotos.map((p) => p.id),
            description: `Share ${count === 1 ? 'it' : 'them'} with ${names}`,
          },
        );
        goalBits.push(`share ${count} ${noun} with ${names}`);
      }
    }

    // Message: an action step in Messages, bound to the people selection, or —
    // "share these and tell them…" — the share's recipients, or failing both,
    // the person they most recently shared with (the recorded fact, read back).
    if (wantsMessage && apps.includes('messages')) {
      const recipientIds =
        peopleSelected ??
        (shareRecipients.length
          ? shareRecipients.map((r) => r.id)
          : this.lastSharedWith(ctx));
      if (recipientIds.length) {
        const recipients = recipientIds.map((id) =>
          resolvePerson(this.personId, id),
        );
        const names = recipients.map((r) => r.name).join(', ');
        steps.push({
          id: 'message',
          app: 'messages',
          intent: 'send-message',
          ids: recipientIds,
          payload: { text: this.draftMessage(recipients) },
          description: `Send a message to ${names}`,
        });
        goalBits.push(`message ${names}`);
      }
    }

    // Reminder: an action step in Reminders; the title comes from the request
    // ("remind me to print one" -> "print one") or falls back to the share.
    if (wantsReminder && apps.includes('reminders')) {
      const match = request.match(/remind (?:me )?(?:to )?([^,.!?]+)/i);
      const title =
        match?.[1]?.trim() ??
        (sharePhotos.length
          ? `Follow up on ${sharePhotos.length} shared photo${
              sharePhotos.length === 1 ? '' : 's'
            }`
          : 'Follow up');
      steps.push({
        id: 'remind',
        app: 'reminders',
        intent: 'create-reminder',
        ids: sharePhotos.map((p) => p.id),
        payload: { title },
        description: `Add reminder: “${title}”`,
      });
      goalBits.push('add a reminder');
    }

    if (!steps.some((s) => s.intent)) return null;

    // Confirmation hop: only when a share is the last effect (a send-message
    // step already ends the plan inside Messages).
    if (
      steps.some((s) => s.intent === 'share-photos') &&
      !steps.some((s) => s.intent === 'send-message') &&
      apps.includes('messages')
    ) {
      steps.push({
        id: 'confirm',
        app: 'messages',
        description: 'Open Messages to confirm the send',
      });
    }

    const goal = goalBits.join(' + ');
    return {
      id: uid('plan'),
      goal: goal.charAt(0).toUpperCase() + goal.slice(1),
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
      const [top] = this.suggest(ctx).filter(
        (s) => s.intent === 'share-photos',
      );
      if (!top) {
        return {
          text: `${greeting}Nothing new to share right now — everything recent has already been sent.`,
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
