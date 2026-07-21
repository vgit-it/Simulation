import { afterEach, describe, expect, it, vi } from 'vitest';
import { assembleContext } from '../../context';
import { freshState } from '../../state';
import { buildLLMRequest } from './prompt';
import {
  callGemini,
  callGeminiWithFallback,
  modelChain,
  parseChatReply,
  toGeminiRequest,
  withRequestedShareRecipients,
} from './gemini';
import { GEMINI_FALLBACK_MODELS } from '../../config';

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

  it('carries a token budget with headroom for thinking + JSON', () => {
    // Thinking models bill reasoning against maxOutputTokens; a tiny ceiling
    // truncates the answer. The default must leave real room (regression: was
    // 1024, which cut plans off mid-object).
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(4096);
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

  it('passes genuine prose through (model ignored JSON mode)', () => {
    const reply = parseChatReply('not json at all');
    expect(reply.text).toBe('not json at all');
    expect(reply.plan).toBeUndefined();
  });

  it('never surfaces raw JSON when the payload is truncated mid-object', () => {
    // The exact shape the thinking-model budget overrun produced: valid JSON
    // that stops partway. It must NOT reach the user as a blob.
    const truncated = `{
  "text": "I'll help you share the selected photos with Leo Park.",
  "plan": {
    "goal": "Share selected photos with Leo Park",
    "steps": [
      {
        "id": "share-with-leo",
        "app": "photos",
        "intent": "share-photos",
        "ids": [
          "img-003",
          "img-001"
        ],`;
    const reply = parseChatReply(truncated);
    expect(reply.plan).toBeUndefined();
    expect(reply.text).not.toContain('{');
    expect(reply.text).not.toContain('share-photos');
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

describe('callGemini (network boundary)', () => {
  afterEach(() => vi.restoreAllMocks());

  function mockFetch(body: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => body }) as Response),
    );
  }

  it('throws a raise-the-budget error when the candidate finished MAX_TOKENS', async () => {
    // A truncated candidate: partial text present, but finishReason says it was
    // cut off. We must reject it (→ friendly failure) not pass the fragment on.
    mockFetch({
      candidates: [
        {
          finishReason: 'MAX_TOKENS',
          content: { parts: [{ text: '{"text":"I' }] },
        },
      ],
    });
    await expect(
      callGemini(toGeminiRequest(req), 'key', 'gemini-flash-latest'),
    ).rejects.toThrow(/cut off|token budget/i);
  });

  it('returns the model text on a normal STOP finish', async () => {
    mockFetch({
      candidates: [
        { finishReason: 'STOP', content: { parts: [{ text: '{"text":"hi"}' }] } },
      ],
    });
    const text = await callGemini(
      toGeminiRequest(req),
      'key',
      'gemini-flash-latest',
    );
    expect(text).toBe('{"text":"hi"}');
  });
});

describe('model downgrade fallback', () => {
  afterEach(() => vi.restoreAllMocks());

  /** Queue of responses, one popped per fetch call, so we can script a 503
   *  on the primary then a 200 on the backup. */
  function mockFetchQueue(responses: Response[]) {
    const queue = [...responses];
    const fetchMock = vi.fn(async () => {
      const next = queue.shift();
      if (!next) throw new Error('fetch called more times than scripted');
      return next;
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }
  const overloaded = () =>
    ({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'high demand' } }),
    }) as Response;
  const badKey = () =>
    ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'API key not valid' } }),
    }) as Response;
  const okText = (text: string) =>
    ({
      ok: true,
      json: async () => ({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
      }),
    }) as Response;

  it('modelChain puts the configured model first, then the backups', () => {
    expect(modelChain('gemini-flash-latest')).toEqual([
      'gemini-flash-latest',
      ...GEMINI_FALLBACK_MODELS,
    ]);
  });

  it('modelChain de-dupes when the configured model is already a backup', () => {
    const backup = GEMINI_FALLBACK_MODELS[0];
    expect(modelChain(backup)).toEqual([backup]);
  });

  it('downgrades to the backup model when the primary is overloaded (503)', async () => {
    const fetchMock = mockFetchQueue([overloaded(), okText('{"text":"from lite"}')]);
    const text = await callGeminiWithFallback(toGeminiRequest(req), 'key', [
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
    ]);
    expect(text).toBe('{"text":"from lite"}');
    expect(fetchMock).toHaveBeenCalledTimes(2); // primary failed, backup answered
  });

  it('does NOT downgrade on a non-retryable failure (e.g. bad key)', async () => {
    const fetchMock = mockFetchQueue([badKey()]);
    await expect(
      callGeminiWithFallback(toGeminiRequest(req), 'key', [
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
      ]),
    ).rejects.toThrow(/Gemini 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // failed fast, backup never tried
  });

  it('throws the last error when every model is overloaded', async () => {
    mockFetchQueue([overloaded(), overloaded()]);
    await expect(
      callGeminiWithFallback(toGeminiRequest(req), 'key', [
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
      ]),
    ).rejects.toThrow(/Gemini 503/);
  });
});

describe('withRequestedShareRecipients (model-plan safety net)', () => {
  // img-003 (Ava's gallery) is tagged with BOTH leo-park and sam-ruiz — the
  // exact shape of the reported bug: a model can write a step whose
  // description names one person while leaving payload.recipients empty,
  // which would otherwise commit to everyone tagged.
  const ctx = assembleContext(session, freshState());

  function planReply(payload?: Record<string, unknown>) {
    return {
      text: 'Sure, sharing that now.',
      plan: {
        id: 'plan_1',
        goal: 'Share with Leo',
        steps: [
          {
            id: 'share',
            app: 'photos',
            description: 'Share it with Leo Park', // the model's own (correct) prose
            intent: 'share-photos',
            ids: ['img-003'],
            ...(payload && { payload }),
          },
        ],
      },
    };
  }

  it('narrows a share step the model left unscoped, using the request text', () => {
    const reply = withRequestedShareRecipients(
      planReply(),
      ctx,
      'share this with Leo',
    );
    expect(reply.plan!.steps[0].payload).toEqual({ recipients: ['leo-park'] });
  });

  it('leaves a step alone when the model already supplied recipients', () => {
    const reply = withRequestedShareRecipients(
      planReply({ recipients: ['sam-ruiz'] }),
      ctx,
      'share this with Leo', // text says Leo, but the model's own choice wins
    );
    expect(reply.plan!.steps[0].payload).toEqual({ recipients: ['sam-ruiz'] });
  });

  it('leaves a step alone when neither a name nor a selection narrows it', () => {
    const reply = withRequestedShareRecipients(planReply(), ctx, 'share this');
    expect(reply.plan!.steps[0].payload).toBeUndefined();
  });

  it('is a no-op for a reply with no plan', () => {
    const reply = { text: 'just some prose' };
    expect(withRequestedShareRecipients(reply, ctx, 'share this with Leo')).toBe(
      reply,
    );
  });
});
