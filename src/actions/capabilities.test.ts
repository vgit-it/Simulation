import { describe, expect, it } from 'vitest';
import { assembleContext } from '../context';
import { freshState } from '../state/reducer';
import { world } from '../world';
import {
  capabilityFor,
  listCapabilities,
  viableCapabilities,
} from './capabilities';
import { propose } from './index';

const session = { personId: 'ava-chen', deviceId: 'ava-phone' };

describe('capability registry', () => {
  it('contains exactly the actions the apps declare', () => {
    const declared = Object.values(world.apps)
      .flatMap((app) => app.actions.map((a) => [a.id, app.id]))
      .sort();
    const registered = listCapabilities()
      .map((c) => [c.intent, c.app])
      .sort();
    expect(registered).toEqual(declared);
  });

  it('exposes the authored selection requirement', () => {
    const share = capabilityFor('share-photos');
    expect(share.app).toBe('photos');
    expect(share.selection).toEqual({ kind: 'photos', min: 1 });
  });

  it('throws loudly for an unknown intent', () => {
    expect(() => capabilityFor('teleport')).toThrow(/Unknown intent/);
  });

  it('builds a share proposal from photo ids', () => {
    const ctx = assembleContext(session, freshState());
    const proposal = capabilityFor('share-photos').propose(ctx, ['img-001']);
    expect(proposal.intent).toBe('share-photos');
    expect(proposal.attachments).toEqual(['img-001']);
    // img-001 has sam-ruiz alongside ava — he becomes the recipient.
    expect(proposal.recipients.map((r) => r.id)).toEqual(['sam-ruiz']);
    const sent = proposal.events.find((e) => e.type === 'MessageSent');
    expect(sent).toBeDefined();
  });

  it('rejects photo ids the owner does not have', () => {
    const ctx = assembleContext(session, freshState());
    expect(() =>
      capabilityFor('share-photos').propose(ctx, ['img-999']),
    ).toThrow(/img-999/);
  });
});

describe('send-message capability', () => {
  it('drafts a message to the given people via the brain', () => {
    const ctx = assembleContext(session, freshState());
    const proposal = capabilityFor('send-message').propose(ctx, ['sam-ruiz']);
    expect(proposal.recipients.map((r) => r.id)).toEqual(['sam-ruiz']);
    expect(proposal.message.length).toBeGreaterThan(0);
    expect(proposal.invalidReason).toBeUndefined();
    const sent = proposal.events.find((e) => e.type === 'MessageSent');
    expect(sent).toMatchObject({ to: ['sam-ruiz'], intent: 'send-message' });
  });

  it('uses payload text verbatim when provided', () => {
    const ctx = assembleContext(session, freshState());
    const proposal = capabilityFor('send-message').propose(ctx, ['sam-ruiz'], {
      text: 'See you at 6!',
    });
    expect(proposal.message).toBe('See you at 6!');
  });

  it('is invalid with no recipients', () => {
    const ctx = assembleContext(session, freshState());
    const proposal = capabilityFor('send-message').propose(ctx, []);
    expect(proposal.invalidReason).toBeDefined();
  });
});

describe('create-reminder capability', () => {
  it('creates a reminder from a payload title, valid without recipients', () => {
    const ctx = assembleContext(session, freshState());
    const proposal = capabilityFor('create-reminder').propose(ctx, ['img-001'], {
      title: 'Print the picnic photo',
    });
    expect(proposal.recipients).toEqual([]);
    expect(proposal.invalidReason).toBeUndefined();
    expect(proposal.confirmLabel).toBe('Add');
    const created = proposal.events.find((e) => e.type === 'ReminderCreated');
    expect(created).toMatchObject({
      title: 'Print the picnic photo',
      related: ['img-001'],
    });
  });

  it('is invalid without a title', () => {
    const ctx = assembleContext(session, freshState());
    const proposal = capabilityFor('create-reminder').propose(ctx, []);
    expect(proposal.invalidReason).toBeDefined();
  });
});

describe('viableCapabilities', () => {
  it('excludes selection-requiring capabilities when nothing is selected', () => {
    const ctx = assembleContext(session, freshState());
    expect(viableCapabilities(ctx).map((c) => c.intent)).not.toContain(
      'share-photos',
    );
  });

  it('includes share-photos once photos are selected', () => {
    const ctx = assembleContext(
      { ...session, selection: { app: 'photos', kind: 'photos', ids: ['img-001'] } },
      freshState(),
    );
    expect(viableCapabilities(ctx).map((c) => c.intent)).toContain(
      'share-photos',
    );
  });

  it('includes send-message only with a people selection', () => {
    const none = assembleContext(session, freshState());
    expect(viableCapabilities(none).map((c) => c.intent)).not.toContain(
      'send-message',
    );
    const withPeople = assembleContext(
      { ...session, selection: { app: 'contacts', kind: 'people', ids: ['sam-ruiz'] } },
      freshState(),
    );
    expect(viableCapabilities(withPeople).map((c) => c.intent)).toContain(
      'send-message',
    );
  });

  it('always includes create-reminder when the app is installed (no selection needed)', () => {
    const ctx = assembleContext(session, freshState());
    expect(viableCapabilities(ctx).map((c) => c.intent)).toContain(
      'create-reminder',
    );
  });

  it('excludes capabilities whose app is not on the embodied device', () => {
    const ctx = assembleContext(
      { ...session, selection: { app: 'photos', kind: 'photos', ids: ['img-001'] } },
      freshState(),
    );
    const withoutPhotos = {
      ...ctx,
      device: { ...ctx.device, apps: ctx.device.apps.filter((a) => a !== 'photos') },
    };
    expect(viableCapabilities(withoutPhotos).map((c) => c.intent)).not.toContain(
      'share-photos',
    );
  });
});

describe('context folds the session selection into the situation', () => {
  it('carries the selection and defaults the app from it', () => {
    const selection = { app: 'photos', kind: 'photos', ids: ['img-001'] };
    const ctx = assembleContext({ ...session, selection }, freshState());
    expect(ctx.situation.selection).toEqual(selection);
    expect(ctx.situation.app).toBe('photos');
  });

  it('lets an explicit situation override the session selection', () => {
    const selection = { app: 'photos', kind: 'photos', ids: ['img-001'] };
    const ctx = assembleContext({ ...session, selection }, freshState(), {
      selection: null,
      app: 'messages',
    });
    expect(ctx.situation.selection).toBeNull();
    expect(ctx.situation.app).toBe('messages');
  });

  it('propose() by ids routes through the registry', () => {
    const ctx = assembleContext(session, freshState());
    const [first] = ctx.owner.gallery;
    const proposal = propose('share-photos', ctx, [first.id]);
    expect(proposal.attachments).toEqual([first.id]);
  });
});
