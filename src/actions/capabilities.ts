import type { ContextBundle } from '../context';
import { uid, type SimEvent } from '../state';
import { world, type Photo, type SelectionSpec } from '../world';
import type { Proposal } from './index';

/**
 * The capability registry: the machine-readable catalog of everything the
 * assistant (and later, a planner) can DO, built by joining each app's authored
 * `actions:` frontmatter (world/apps/*.md — the declaration) with a propose
 * implementation registered here (the binding). The app file stays the single
 * source of truth for what exists and what it needs selected; this file only
 * says how to build the Proposal. A declared action with no implementation —
 * or an implementation no app declares — fails loudly at load.
 */
export interface Capability {
  /** The intent id, e.g. 'share-photos' (== the app action id). */
  intent: string;
  /** The app that owns/declares this capability. */
  app: string;
  label: string;
  /** What must be selected for this capability to apply (absent = none). */
  selection?: SelectionSpec;
  /** Build a previewable Proposal from object ids — never mutates. */
  propose: (ctx: ContextBundle, ids: string[]) => Proposal;
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

function proposeSharePhotos(ctx: ContextBundle, ids: string[]): Proposal {
  const photos = ownedPhotos(ctx, ids);
  const draft = ctx.brain.draftShare(photos);
  const at = ctx.now.getTime();
  const to = draft.recipients.map((r) => r.id);

  const events: SimEvent[] = [
    {
      type: 'MessageSent',
      id: uid('msg'),
      at,
      from: ctx.owner.id,
      to,
      body: draft.message,
      attachments: ids,
      intent: 'share-photos',
    },
    ...draft.recipients.map(
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
    summary: draft.recipients.length
      ? `With ${draft.recipients.map((r) => r.name).join(', ')}`
      : 'No one else is in these photos',
    recipients: draft.recipients,
    message: draft.message,
    attachments: ids,
    events,
  };
}

/** intent id -> how to build its Proposal. One entry per new action. */
const implementations: Record<
  string,
  (ctx: ContextBundle, ids: string[]) => Proposal
> = {
  'share-photos': proposeSharePhotos,
};

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
      registry.set(action.id, {
        intent: action.id,
        app: app.id,
        label: action.label,
        selection: action.selection,
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
