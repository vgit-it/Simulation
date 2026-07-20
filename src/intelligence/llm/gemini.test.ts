import { describe, expect, it } from 'vitest';
import { assembleContext } from '../../context';
import { freshState } from '../../state';
import { buildLLMRequest } from './prompt';
import { parseChatReply, toGeminiRequest } from './gemini';

const session = { personId: 'ava-chen', deviceId: 'ava-phone' };
const req = buildLLMRequest(assembleContext(session, freshState()), [], 'hello');

describe('toGeminiRequest (neutral LLMRequest -> Gemini REST body)', () => {
  const body = toGeminiRequest(req);

  it('folds the system prompt and the tool catalog into systemInstruction', () => {
    const text = body.systemInstruction.parts[0].text;
    expect(text).toContain('Ava Chen (ava-chen)'); // the system prompt
    expect(text).toContain('## Available tools'); // tools folded in
    expect(text).toContain('share-photos'); // a real capability name
  });

  it('remaps message roles (assistant -> model) and wraps text in parts', () => {
    const withHistory = toGeminiRequest(
      buildLLMRequest(
        assembleContext(session, freshState()),
        [
          { role: 'user', text: 'hi' },
          { role: 'assistant', text: 'hello there' },
        ],
        'again',
      ),
    );
    expect(withHistory.contents.map((c) => c.role)).toEqual([
      'user',
      'model',
      'user',
    ]);
    expect(withHistory.contents[1].parts[0].text).toBe('hello there');
  });

  it('maps max_tokens and requests structured JSON output', () => {
    expect(body.generationConfig.maxOutputTokens).toBe(req.max_tokens);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });
});

describe('parseChatReply (Gemini text -> ChatReply)', () => {
  it('parses a plain-text reply', () => {
    const reply = parseChatReply('{"text":"just a thought"}');
    expect(reply.text).toBe('just a thought');
    expect(reply.plan).toBeUndefined();
  });

  it('unwraps a ```json fenced object', () => {
    const reply = parseChatReply('```json\n{"text":"fenced"}\n```');
    expect(reply.text).toBe('fenced');
  });

  it('builds a plan, synthesizing missing plan/step ids', () => {
    const reply = parseChatReply(
      JSON.stringify({
        text: 'here you go',
        plan: {
          goal: 'Share this week',
          steps: [
            { app: 'photos', description: 'Open Photos' },
            {
              app: 'photos',
              description: 'Share them',
              intent: 'share-photos',
              ids: ['img-001'],
            },
          ],
        },
      }),
    );
    expect(reply.plan).toBeDefined();
    expect(reply.plan!.id).toMatch(/^plan/);
    expect(reply.plan!.steps).toHaveLength(2);
    expect(reply.plan!.steps.every((s) => s.id)).toBe(true);
    expect(reply.plan!.steps[1].intent).toBe('share-photos');
  });

  it('drops a step whose intent is not a real capability', () => {
    const reply = parseChatReply(
      JSON.stringify({
        text: 'ok',
        plan: {
          goal: 'Do stuff',
          steps: [
            { app: 'photos', description: 'real', intent: 'share-photos', ids: [] },
            { app: 'photos', description: 'fake', intent: 'teleport-photos', ids: [] },
          ],
        },
      }),
    );
    expect(reply.plan!.steps).toHaveLength(1);
    expect(reply.plan!.steps[0].intent).toBe('share-photos');
  });

  it('degrades malformed output to a plain-text reply instead of throwing', () => {
    const reply = parseChatReply('not json at all');
    expect(reply.text).toBe('not json at all');
    expect(reply.plan).toBeUndefined();
  });

  it('treats a plan with no runnable steps left as no plan', () => {
    const reply = parseChatReply(
      JSON.stringify({
        text: 'hmm',
        plan: {
          goal: 'Nope',
          steps: [{ app: 'photos', description: 'fake', intent: 'nonexistent' }],
        },
      }),
    );
    expect(reply.plan).toBeUndefined();
    expect(reply.text).toBe('hmm');
  });
});
