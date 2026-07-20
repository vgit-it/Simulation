import { describe, expect, it } from 'vitest';
import { assembleContext } from '../context';
import { MockIntelligence } from '../intelligence/mock';
import { freshState, hydrate } from '../state/reducer';
import { plansFor } from '../state/selectors';
import { resolvePlanStep } from './executor';

const session = { personId: 'ava-chen', deviceId: 'ava-phone' };
const brain = new MockIntelligence().for('ava-chen');
// A clock close to Ava's newest photos so "this week" is non-empty.
const state = { ...freshState(), clock: new Date('2026-07-16T12:00:00').getTime() };

describe('MockIntelligence.plan', () => {
  it('decomposes "share this week\'s photos" into gather -> share -> confirm', () => {
    const ctx = assembleContext(session, state);
    const plan = brain.plan(ctx, "share this week's photos");
    expect(plan).not.toBeNull();
    expect(plan!.steps.map((s) => s.app)).toEqual([
      'photos',
      'photos',
      'messages',
    ]);
    const action = plan!.steps.find((s) => s.intent);
    expect(action?.intent).toBe('share-photos');
    expect(action?.ids?.length).toBeGreaterThan(0);
    expect(plan!.goal).toMatch(/Share \d+ photo/);
  });

  it('binds the action step to the current selection when photos are picked', () => {
    const ctx = assembleContext(
      { ...session, selection: { app: 'photos', kind: 'photos', ids: ['img-002'] } },
      state,
    );
    const plan = brain.plan(ctx, 'share these');
    expect(plan).not.toBeNull();
    const action = plan!.steps.find((s) => s.intent);
    expect(action?.ids).toEqual(['img-002']);
    expect(plan!.steps[0].description).toMatch(/selected/);
  });

  it('returns null for a request that maps to no capability', () => {
    const ctx = assembleContext(session, state);
    expect(brain.plan(ctx, 'what time is it?')).toBeNull();
  });

  it('composes share + reminder into one cross-app plan', () => {
    const ctx = assembleContext(
      { ...session, selection: { app: 'photos', kind: 'photos', ids: ['img-001'] } },
      state,
    );
    const plan = brain.plan(ctx, 'share these and remind me to print one');
    expect(plan).not.toBeNull();
    const intents = plan!.steps.map((s) => s.intent).filter(Boolean);
    expect(intents).toEqual(['share-photos', 'create-reminder']);
    const remind = plan!.steps.find((s) => s.intent === 'create-reminder');
    expect(remind?.payload).toEqual({ title: 'print one' });
    expect(remind?.app).toBe('reminders');
    expect(plan!.goal).toMatch(/\+ add a reminder/);
  });

  it('plans a send-message from a people selection (open thread / tapped contact)', () => {
    const ctx = assembleContext(
      { ...session, selection: { app: 'messages', kind: 'people', ids: ['sam-ruiz'] } },
      state,
    );
    const plan = brain.plan(ctx, 'tell him hi');
    expect(plan).not.toBeNull();
    const msg = plan!.steps.find((s) => s.intent === 'send-message');
    expect(msg?.ids).toEqual(['sam-ruiz']);
    expect(msg?.app).toBe('messages');
    expect((msg?.payload as { text: string }).text.length).toBeGreaterThan(0);
  });

  it('chains share + message to the share recipients ("share these and tell them...")', () => {
    const ctx = assembleContext(
      { ...session, selection: { app: 'photos', kind: 'photos', ids: ['img-001'] } },
      state,
    );
    const plan = brain.plan(ctx, 'share these and tell them about Saturday');
    expect(plan).not.toBeNull();
    const intents = plan!.steps.map((s) => s.intent).filter(Boolean);
    expect(intents).toEqual(['share-photos', 'send-message']);
    // img-001 contains sam-ruiz -> he is the share recipient and message target.
    const msg = plan!.steps.find((s) => s.intent === 'send-message');
    expect(msg?.ids).toEqual(['sam-ruiz']);
    // The message step already ends in Messages — no redundant confirm hop.
    expect(plan!.steps.some((s) => s.id === 'confirm')).toBe(false);
  });

  it('falls back to the last-shared-with fact for an unbound message request', () => {
    // No selection, no share step — but Ava's log says she last shared with Leo.
    const seeded = {
      ...state,
      facts: {
        'ava-chen': [
          { at: 1, key: 'last-shared-with', value: 'sam-ruiz' },
          { at: 2, key: 'last-shared-with', value: 'leo-park' },
        ],
      },
    };
    const ctx = assembleContext(session, seeded);
    const plan = brain.plan(ctx, 'send a message saying hi');
    expect(plan).not.toBeNull();
    const msg = plan!.steps.find((s) => s.intent === 'send-message');
    expect(msg?.ids).toEqual(['leo-park']); // the most recent fact wins
  });

  it('skips steps whose app is not installed on the device', () => {
    const ctx = assembleContext(session, state);
    // Leo's phone: check what a reminder-less device would plan. Build a ctx
    // with reminders stripped from the device app list.
    const stripped = {
      ...ctx,
      device: { ...ctx.device, apps: ctx.device.apps.filter((a) => a !== 'reminders') },
    };
    const plan = brain.plan(stripped, 'share this week and remind me to print');
    expect(plan).not.toBeNull();
    expect(plan!.steps.some((s) => s.intent === 'create-reminder')).toBe(false);
  });

  it('respond() surfaces a plan for an imperative request but not an advisory one', async () => {
    const ctx = assembleContext(session, state);
    expect((await brain.respond(ctx, [], "share this week's photos")).plan).toBeDefined();
    expect(
      (await brain.respond(ctx, [], 'What should I share this week?')).plan,
    ).toBeUndefined();
  });
});

describe('resolvePlanStep', () => {
  it('opens the app for a navigate step (no proposal)', () => {
    const result = resolvePlanStep(
      { id: 'g', app: 'photos', description: 'Gather' },
      session,
      state,
    );
    expect(result.screen).toEqual({ kind: 'app', appId: 'photos' });
    expect(result.proposal).toBeUndefined();
    expect(result.events[0]).toMatchObject({ type: 'AppOpened', appId: 'photos' });
  });

  it('builds (but does not commit) a proposal for an action step', () => {
    const result = resolvePlanStep(
      { id: 's', app: 'photos', description: 'Share', intent: 'share-photos', ids: ['img-001'] },
      session,
      state,
    );
    expect(result.proposal?.intent).toBe('share-photos');
    expect(result.proposal?.attachments).toEqual(['img-001']);
  });
});

describe('plan run events fold into derived state', () => {
  it('records a running plan (with its supervision level) and marks it completed', () => {
    const log = [
      {
        type: 'PlanStarted' as const,
        at: 1,
        person: 'ava-chen',
        planId: 'plan_1',
        goal: 'Share 2 photos with Sam Ruiz',
        steps: 3,
        supervision: 'confirm-once',
      },
      {
        type: 'PlanCompleted' as const,
        at: 2,
        person: 'ava-chen',
        planId: 'plan_1',
        outcome: 'completed' as const,
      },
    ];
    const runs = plansFor(hydrate(log), 'ava-chen');
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      outcome: 'completed',
      steps: 3,
      supervision: 'confirm-once',
    });
  });
});
