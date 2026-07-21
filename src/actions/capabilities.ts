import type { ContextBundle } from '../context';
import { requestedShareRecipients } from '../intelligence/shareRecipients';
import { uid, type SimEvent } from '../state';
import {
  resolvePerson,
  world,
  type AppAction,
  type Photo,
  type SelectionSpec,
} from '../world';
import type { Proposal } from './index';
import type { Candidate, Slot, SlotResolver } from './requirements';

/**
 * The capability registry: the machine-readable catalog of everything the
 * assistant (and the planner) can DO, built by joining each app's authored
 * `actions:` frontmatter (world/apps/*.md — the declaration) with a propose
 * implementation registered here (the binding). The app file stays the single
 * source of truth for what exists and what it needs selected; this file only
 * says how to build the Proposal. A declared action with no implementation —
 * or an implementation no app declares — fails loudly at load.
 */

/** Free-form per-intent inputs (e.g. a message's text, a reminder's title). */
export type ActionPayload = Record<string, unknown>;

export interface Capability {
  /** The intent id, e.g. 'share-photos' (== the app action id). */
  intent: string;
  /** The app that owns/declares this capability. */
  app: string;
  label: string;
  /** What must be selected for this capability to apply (absent = none). */
  selection?: SelectionSpec;
  /**
   * The inputs this action needs (its selection operand + declared payload
   * slots), joined from the app's world file — the slot-filling vocabulary.
   */
  slots: Slot[];
  /**
   * Per-slot value resolvers for slots with a smart default (e.g. share
   * recipients drafted from photo tags). Slots without one use the generic
   * "is the value present" check. Keys are slot keys.
   */
  resolvers: Record<string, SlotResolver>;
  /** Build a previewable Proposal from object ids + payload — never mutates. */
  propose: (ctx: ContextBundle, ids: string[], payload?: ActionPayload) => Proposal;
}

/** Resolve gallery photo ids against the context owner, loudly. */
function ownedPhotos(ctx: ContextBundle, ids: string[]): Photo[] {
  const photos = ctx.owner.gallery.filter((p) => ids.includes(p.id));
  if (photos.length !== ids.length) {
    const known = new Set(photos.map((p) => p.id));
    const missing = ids.filter((id) => !known.has(id));
    throw new Error(
      `Unknown photo id(s) for "${ctx.owner.id}": ${missing.join(', ')}`,
    );
  }
  return photos;
}

function proposeSharePhotos(
  ctx: ContextBundle,
  ids: string[],
  payload?: ActionPayload,
): Proposal {
  const photos = ownedPhotos(ctx, ids);
  const draft = ctx.brain.draftShare(photos);
  // Payload overrides (user edits / planner choices) win over the draft.
  const recipients = Array.isArray(payload?.recipients)
    ? (payload.recipients as string[]).map((id) => resolvePerson(ctx.owner.id, id))
    : draft.recipients;
  const message =
    typeof payload?.message === 'string' ? payload.message : draft.message;
  const at = ctx.now.getTime();

  const events: SimEvent[] = [
    {
      type: 'MessageSent',
      id: uid('msg'),
      at,
      from: ctx.owner.id,
      to: recipients.map((r) => r.id),
      body: message,
      attachments: ids,
      intent: 'share-photos',
    },
    ...recipients.map(
      (r): SimEvent => ({
        type: 'FactRecorded',
        at,
        person: ctx.owner.id,
        key: 'last-shared-with',
        value: r.id,
      }),
    ),
  ];

  const count = ids.length;
  return {
    id: uid('prop'),
    intent: 'share-photos',
    title: `Share ${count} photo${count === 1 ? '' : 's'}`,
    summary: recipients.length
      ? `With ${recipients.map((r) => r.name).join(', ')}`
      : 'No one to share with',
    recipients,
    message,
    attachments: ids,
    events,
    invalidReason: recipients.length ? undefined : 'No one to share with',
    amend: (edit) =>
      proposeSharePhotos(ctx, ids, {
        ...payload,
        ...(edit.message !== undefined && { message: edit.message }),
        ...(edit.recipientIds && { recipients: edit.recipientIds }),
      }),
  };
}

function proposeSendMessage(
  ctx: ContextBundle,
  ids: string[],
  payload?: ActionPayload,
): Proposal {
  const recipients = ids.map((id) => resolvePerson(ctx.owner.id, id));
  const names = recipients.map((r) => r.name).join(', ');
  // An explicit payload text wins even when empty (an edit that clears the
  // text should make the proposal invalid, not resurrect the draft).
  const text =
    typeof payload?.text === 'string'
      ? payload.text.trim()
      : ctx.brain.draftMessage(recipients);
  const attachments = Array.isArray(payload?.attachments)
    ? (payload.attachments as string[])
    : [];
  const at = ctx.now.getTime();

  const events: SimEvent[] = [
    {
      type: 'MessageSent',
      id: uid('msg'),
      at,
      from: ctx.owner.id,
      to: ids,
      body: text,
      attachments,
      intent: 'send-message',
    },
  ];

  return {
    id: uid('prop'),
    intent: 'send-message',
    title: `Message ${names || '…'}`,
    summary: ids.length ? `To ${names}` : 'No recipients selected',
    recipients,
    message: text,
    attachments,
    events,
    invalidReason: !ids.length
      ? 'No recipients selected'
      : !text
        ? 'The message is empty'
        : undefined,
    amend: (edit) =>
      proposeSendMessage(ctx, edit.recipientIds ?? ids, {
        ...payload,
        ...(edit.message !== undefined && { text: edit.message }),
      }),
  };
}

function proposeCreateReminder(
  ctx: ContextBundle,
  ids: string[],
  payload?: ActionPayload,
): Proposal {
  const title = typeof payload?.title === 'string' ? payload.title.trim() : '';
  const at = ctx.now.getTime();
  // Related photo ids must be real (renderable) — validate loudly like a share.
  if (ids.length) ownedPhotos(ctx, ids);

  const events: SimEvent[] = [
    {
      type: 'ReminderCreated',
      id: uid('rem'),
      at,
      person: ctx.owner.id,
      title,
      related: ids,
    },
  ];

  return {
    id: uid('prop'),
    intent: 'create-reminder',
    title: 'Add reminder',
    summary: title || 'What should I remind you about?',
    recipients: [],
    message: title,
    attachments: ids,
    events,
    confirmLabel: 'Add',
    invalidReason: title ? undefined : 'The reminder needs a title',
    amend: (edit) =>
      proposeCreateReminder(ctx, ids, {
        ...payload,
        ...(edit.message !== undefined && { title: edit.message }),
      }),
  };
}

/** intent id -> how to build its Proposal. One entry per new action. */
const implementations: Record<
  string,
  (ctx: ContextBundle, ids: string[], payload?: ActionPayload) => Proposal
> = {
  'share-photos': proposeSharePhotos,
  'send-message': proposeSendMessage,
  'create-reminder': proposeCreateReminder,
};

/**
 * Slot value resolvers for slots that have a smart default — so the assistant
 * only asks the user when a value genuinely can't be inferred. Each rung stamps
 * a CONFIDENCE: recipients for a share come from (in order) an explicit payload
 * (`high`), a person named in the request text (`high`), or "everyone tagged in
 * the photo" (`medium` — a sensible default, but one worth confirming, not
 * silently sending to); only when all three are empty is the slot elicited.
 * Slots not listed here fall back to the generic presence check.
 */
const shareResolvers: Record<string, SlotResolver> = {
  recipients: (ctx, ids, payload, request): Candidate | null => {
    if (Array.isArray(payload.recipients) && payload.recipients.length) {
      return { value: payload.recipients, confidence: 'high', source: 'payload' };
    }
    const named = requestedShareRecipients(ctx, request, ctx.owner.id);
    if (named) {
      return { value: named.map((r) => r.id), confidence: 'high', source: 'request' };
    }
    const photos = ctx.owner.gallery.filter((p) => ids.includes(p.id));
    const drafted = ctx.brain.draftShare(photos).recipients;
    return drafted.length
      ? { value: drafted.map((r) => r.id), confidence: 'medium', source: 'default' }
      : null;
  },
};

const messageResolvers: Record<string, SlotResolver> = {
  // The recipients ARE the operand ids; if none are bound, try a name in the
  // request text before giving up and asking who to message.
  people: (ctx, ids, _payload, request): Candidate | null => {
    if (ids.length) return { value: ids, confidence: 'high', source: 'selection' };
    const named = requestedShareRecipients(ctx, request, ctx.owner.id);
    return named
      ? { value: named.map((r) => r.id), confidence: 'high', source: 'request' }
      : null;
  },
};

/** intent id -> its per-slot resolvers (absent = all slots use the generic check). */
const requirementResolvers: Record<string, Record<string, SlotResolver>> = {
  'share-photos': shareResolvers,
  'send-message': messageResolvers,
};

/** Join an action's world declaration into the flat slot list. */
function slotsFor(action: AppAction): Slot[] {
  const slots: Slot[] = [];
  if (action.selection) {
    slots.push({
      key: action.selection.kind,
      prompt: action.selection.prompt ?? `Which ${action.selection.kind}?`,
      source: 'selection',
      min: action.selection.min,
    });
  }
  for (const req of action.requires) {
    slots.push({
      key: req.key,
      prompt: req.prompt,
      source: 'payload',
      optional: req.optional,
    });
  }
  return slots;
}

function buildRegistry(): Map<string, Capability> {
  const registry = new Map<string, Capability>();
  for (const app of Object.values(world.apps)) {
    for (const action of app.actions) {
      const propose = implementations[action.id];
      if (!propose) {
        throw new Error(
          `world/apps/${app.id}.md declares action "${action.id}" but no ` +
            `implementation is registered in src/actions/capabilities.ts`,
        );
      }
      if (registry.has(action.id)) {
        throw new Error(
          `Action "${action.id}" is declared by both ` +
            `"${registry.get(action.id)!.app}" and "${app.id}" — action ids must be unique`,
        );
      }
      const slots = slotsFor(action);
      const resolvers = requirementResolvers[action.id] ?? {};
      for (const key of Object.keys(resolvers)) {
        if (!slots.some((s) => s.key === key)) {
          throw new Error(
            `Action "${action.id}" registers a resolver for slot "${key}" ` +
              `that it does not declare (in world/apps/${app.id}.md)`,
          );
        }
      }
      registry.set(action.id, {
        intent: action.id,
        app: app.id,
        label: action.label,
        selection: action.selection,
        slots,
        resolvers,
        propose,
      });
    }
  }
  for (const intent of Object.keys(implementations)) {
    if (!registry.has(intent)) {
      throw new Error(
        `Implementation "${intent}" is registered but no world/apps/*.md declares it`,
      );
    }
  }
  return registry;
}

const registry = buildRegistry();

/** Every capability in the world, in app-declaration order. */
export function listCapabilities(): Capability[] {
  return [...registry.values()];
}

export function capabilityFor(intent: string): Capability {
  const capability = registry.get(intent);
  if (!capability) throw new Error(`Unknown intent: ${intent}`);
  return capability;
}

/**
 * The capabilities usable RIGHT NOW given the context: the owning app must be
 * installed on the embodied device, and any required selection must be
 * satisfied by what the user currently has picked. This is the action space a
 * decider (mock today, LLM in M5) chooses from — and the planner's vocabulary.
 */
export function viableCapabilities(ctx: ContextBundle): Capability[] {
  const selection = ctx.situation.selection;
  return listCapabilities().filter((c) => {
    if (!ctx.device.apps.includes(c.app)) return false;
    if (!c.selection) return true;
    return (
      !!selection &&
      selection.kind === c.selection.kind &&
      selection.ids.length >= c.selection.min
    );
  });
}
