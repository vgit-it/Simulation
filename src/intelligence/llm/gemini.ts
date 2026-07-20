import { z } from 'zod';
import { capabilityFor } from '../../actions';
import type { ContextBundle } from '../../context';
import { uid } from '../../state';
import type { Plan, PlanStep } from '../../plans/types';
import type { Photo } from '../../world';
import type {
  ChatReply,
  ChatTurn,
  IntelligenceProvider,
  PersonIntelligence,
  PhotoGroup,
  ResolvedPerson,
  ShareDraft,
  Suggestion,
} from '../types';
import { buildLLMRequest, type LLMRequest } from './prompt';

/**
 * The REAL LLM brain, backed by the Google Gemini API. This is the M5 tail the
 * dry-run harness was built for: `respond` assembles the SAME neutral
 * `LLMRequest` the dry-run provider shows (`buildLLMRequest`), translates it to
 * Gemini's REST shape at the network boundary, sends it with the user's own
 * key, and parses the JSON reply back into the existing `ChatReply`/`Plan`
 * contract — nothing upstream changes.
 *
 * Everything that isn't the decider seam (grouping, drafts, suggestions,
 * plans) delegates to the mock, so the phone stays fully usable and the mock
 * remains the offline default (principle 8). The key lives only in the user's
 * browser (localStorage); the call is made directly from the page — no backend,
 * keeping the static GitHub Pages deploy.
 */

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiBody {
  contents: { role: 'user' | 'model'; parts: { text: string }[] }[];
  systemInstruction: { parts: { text: string }[] };
  generationConfig: {
    maxOutputTokens: number;
    responseMimeType: 'application/json';
  };
}

/**
 * Translate the neutral (Anthropic-shaped) `LLMRequest` into a Gemini
 * `generateContent` body. Gemini's JSON mode doesn't accept Anthropic tool
 * definitions, so the tool catalog is folded into the system text as an
 * "## Available tools" section — which also fixes the system prompt referencing
 * `intent: <a tool name>` without ever enumerating the valid names.
 */
export function toGeminiRequest(req: LLMRequest): GeminiBody {
  const toolLines = req.tools.length
    ? [
        '',
        '## Available tools (use an intent name from this list)',
        ...req.tools.map((t) => `- ${t.name}: ${t.description}`),
      ]
    : [];
  const system = [req.system, ...toolLines].join('\n');

  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: req.max_tokens,
      responseMimeType: 'application/json',
    },
  };
}

/** POST the body to Gemini and return the model's raw text output. */
export async function callGemini(
  body: GeminiBody,
  apiKey: string,
  model: string,
): Promise<string> {
  if (!apiKey) throw new Error('no API key set (Settings ▸ Brain)');
  const res = await fetch(
    `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message ? `: ${err.error.message}` : '';
    } catch {
      // Non-JSON error body — the status alone will have to do.
    }
    throw new Error(`Gemini ${res.status}${detail}`);
  }
  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const finish: string | undefined = candidate?.finishReason;
  const text: string | undefined = candidate?.content?.parts?.[0]?.text;
  // Thinking models bill reasoning tokens against maxOutputTokens; when the
  // budget runs out mid-answer the candidate finishes MAX_TOKENS with partial
  // (or no) JSON. Surface that as a clear error instead of handing a truncated
  // fragment to the parser — a raise-the-budget message, not a broken blob.
  if (finish === 'MAX_TOKENS') {
    throw new Error('response was cut off — raise the model token budget');
  }
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error(
      finish
        ? `Gemini returned no text (finishReason: ${finish})`
        : 'Gemini returned no text (blocked or empty candidate)',
    );
  }
  return text;
}

const stepSchema = z.object({
  id: z.string().optional(),
  app: z.string(),
  description: z.string(),
  intent: z.string().optional(),
  ids: z.array(z.string()).optional(),
  payload: z.record(z.unknown()).optional(),
});

const replySchema = z.object({
  text: z.string(),
  plan: z
    .object({
      goal: z.string(),
      steps: z.array(stepSchema),
    })
    .optional(),
});

/** Strip a ```json … ``` fence if the model wrapped its output in one. */
function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced ? fenced[1] : text).trim();
}

const PARSE_FAILURE_NOTICE =
  "I couldn't read that response — mind asking again?";

/**
 * Degrade a failed parse to a ChatReply WITHOUT ever surfacing raw model
 * output. If the payload looks like JSON (the model tried the contract but the
 * output was malformed or truncated), show a friendly notice — never the blob.
 * Only genuine prose (the model ignored JSON mode and just wrote a sentence) is
 * passed through, since that's already human-readable.
 */
function degrade(text: string): ChatReply {
  const body = stripFence(text);
  const looksLikeJson = /^[[{]/.test(body);
  return { text: looksLikeJson ? PARSE_FAILURE_NOTICE : body };
}

/**
 * Parse the model's text into a `ChatReply`. Validates against the ChatReply
 * contract, synthesizes any missing plan/step ids, and drops steps whose
 * `intent` isn't a real capability (the model can hallucinate tool names).
 * Malformed output degrades to a friendly notice rather than throwing (a bad
 * generation should never crash the chat) and never renders raw JSON.
 */
export function parseChatReply(text: string): ChatReply {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    return degrade(text);
  }
  const result = replySchema.safeParse(parsed);
  if (!result.success) return degrade(text);

  const { text: replyText, plan } = result.data;
  if (!plan) return { text: replyText };

  const steps: PlanStep[] = plan.steps
    .filter((s) => {
      if (!s.intent) return true; // navigate/gather step — always kept.
      try {
        capabilityFor(s.intent); // throws if the intent isn't registered.
        return true;
      } catch {
        return false;
      }
    })
    .map((s) => ({
      id: s.id ?? uid('step'),
      app: s.app,
      description: s.description,
      ...(s.intent ? { intent: s.intent } : {}),
      ...(s.ids ? { ids: s.ids } : {}),
      ...(s.payload ? { payload: s.payload } : {}),
    }));

  // A plan with no runnable steps left is not a plan.
  if (!steps.length) return { text: replyText };

  const builtPlan: Plan = { id: uid('plan'), goal: plan.goal, steps };
  return { text: replyText, plan: builtPlan };
}

class GeminiPersonIntelligence implements PersonIntelligence {
  constructor(
    readonly personId: string,
    private readonly delegate: PersonIntelligence,
    private readonly apiKey: () => string,
    private readonly model: () => string,
  ) {}

  // Everything that isn't the decider seam stays deterministic (the mock).
  groupPhotosByTime(photos: Photo[], now: Date): PhotoGroup[] {
    return this.delegate.groupPhotosByTime(photos, now);
  }
  peopleInPhoto(photo: Photo): ResolvedPerson[] {
    return this.delegate.peopleInPhoto(photo);
  }
  draftShare(photos: Photo[]): ShareDraft {
    return this.delegate.draftShare(photos);
  }
  draftMessage(recipients: ResolvedPerson[]): string {
    return this.delegate.draftMessage(recipients);
  }
  suggest(ctx: ContextBundle): Suggestion[] {
    return this.delegate.suggest(ctx);
  }
  plan(ctx: ContextBundle, request: string): Plan | null {
    return this.delegate.plan(ctx, request);
  }

  async respond(
    ctx: ContextBundle,
    history: ChatTurn[],
    message: string,
  ): Promise<ChatReply> {
    const req = buildLLMRequest(ctx, history, message);
    const body = toGeminiRequest(req);
    const text = await callGemini(body, this.apiKey(), this.model());
    return parseChatReply(text);
  }
}

export class GeminiIntelligence implements IntelligenceProvider {
  private brains = new Map<string, PersonIntelligence>();

  constructor(
    private readonly fallback: IntelligenceProvider,
    private readonly apiKey: () => string,
    private readonly model: () => string,
  ) {}

  for(personId: string): PersonIntelligence {
    let brain = this.brains.get(personId);
    if (!brain) {
      brain = new GeminiPersonIntelligence(
        personId,
        this.fallback.for(personId),
        this.apiKey,
        this.model,
      );
      this.brains.set(personId, brain);
    }
    return brain;
  }
}
