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

  it('propose() by Photo[] still routes through the registry', () => {
    const ctx = assembleContext(session, freshState());
    const [first] = ctx.owner.gallery;
    const proposal = propose('share-photos', ctx, [first]);
    expect(proposal.attachments).toEqual([first.id]);
  });
});
