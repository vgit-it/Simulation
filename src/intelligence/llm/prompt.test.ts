import { describe, expect, it } from 'vitest';
import { assembleContext } from '../../context';
import { freshState } from '../../state';
import { LLMIntelligence } from './index';
import { MockIntelligence } from '../mock';
import { buildLLMRequest, buildSystemPrompt, buildTools } from './prompt';

const session = { personId: 'ava-chen', deviceId: 'ava-phone' };

describe('buildLLMRequest (the M5 payload, assembled without a network)', () => {
  it('system prompt carries the situation: owner, sim time, device, selection', () => {
    const ctx = assembleContext(
      { ...session, selection: { app: 'photos', kind: 'photos', ids: ['img-001'] } },
      freshState(),
    );
    const system = buildSystemPrompt(ctx);
    expect(system).toContain('Ava Chen (ava-chen)');
    expect(system).toContain('2026-07-16 12:00'); // SIM_START, from the store clock
    expect(system).toContain('photos, messages, contacts, reminders');
    expect(system).toContain('1 × photos in photos: [img-001]');
    // World knowledge: gallery metadata and contacts are in the prompt.
    expect(system).toContain('img-001');
    expect(system).toContain('Sam Ruiz');
    // Reply-format contract for the future parser.
    expect(system).toContain('ChatReply');
  });

  it('serializes the capability registry as tools, with selection state', () => {
    const ctx = assembleContext(
      { ...session, selection: { app: 'photos', kind: 'photos', ids: ['img-001'] } },
      freshState(),
    );
    const tools = buildTools(ctx);
    expect(tools.map((t) => t.name).sort()).toEqual([
      'create-reminder',
      'send-message',
      'share-photos',
    ]);
    const share = tools.find((t) => t.name === 'share-photos')!;
    expect(share.description).toContain('Currently satisfied');
    const msg = tools.find((t) => t.name === 'send-message')!;
    expect(msg.description).toContain('NOT currently satisfied');
  });

  it('omits tools whose app is not installed on the embodied device', () => {
    const ctx = assembleContext(session, freshState());
    const stripped = {
      ...ctx,
      device: { ...ctx.device, apps: ctx.device.apps.filter((a) => a !== 'reminders') },
    };
    expect(buildTools(stripped).map((t) => t.name)).not.toContain(
      'create-reminder',
    );
  });

  it('threads chat history + the new message into API messages', () => {
    const ctx = assembleContext(session, freshState());
    const req = buildLLMRequest(
      ctx,
      [
        { role: 'user', text: 'hi' },
        { role: 'assistant', text: 'Hi!' },
      ],
      'share these',
    );
    expect(req.messages).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Hi!' },
      { role: 'user', content: 'share these' },
    ]);
    expect(req.model).toBeTruthy();
    expect(req.max_tokens).toBeGreaterThan(0);
  });
});

describe('LLMIntelligence (dry run)', () => {
  const provider = new LLMIntelligence(new MockIntelligence());
  const brain = provider.for('ava-chen');

  it('respond() returns the payload instead of completing the task', () => {
    const ctx = assembleContext(session, freshState());
    const reply = brain.respond(ctx, [], 'share this week and remind me to print one');
    expect(reply.text).toContain('dry run');
    expect(reply.plan).toBeUndefined(); // it did NOT do the task
    expect(reply.llmRequest).toBeDefined();
    expect(reply.llmRequest!.messages.at(-1)).toEqual({
      role: 'user',
      content: 'share this week and remind me to print one',
    });
  });

  it('delegates non-decider methods so the phone stays usable', () => {
    const ctx = assembleContext(session, freshState());
    // Suggestions still work (deterministic, from the mock).
    expect(brain.suggest(ctx).length).toBeGreaterThan(0);
    // Grouping still works.
    expect(
      brain.groupPhotosByTime(ctx.owner.gallery, ctx.now).length,
    ).toBeGreaterThan(0);
  });
});
