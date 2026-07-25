import { listCapabilities } from '../../actions';
import type { ContextBundle } from '../../context';
import type { Plan } from '../../plans/types';
import { factsFor, messagesInvolving, plansFor, remindersFor } from '../../state';
import { unassignedItems } from '../../strands/collect';
import type { Strand } from '../../strands/types';
import { contactsOf, resolvePerson } from '../../world';
import type { ChatTurn } from '../types';

/**
 * The EXACT request an LLM-backed brain will send to the Anthropic Messages
 * API — assembled deterministically from the ContextBundle. Built now (pre-M5)
 * so the dry-run provider can show it verbatim; when the real connection
 * lands, this same builder feeds the network call and NOTHING upstream
 * changes. No key, no endpoint, no network anywhere in this module.
 */
export interface LLMTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMRequest {
  model: string;
  max_tokens: number;
  system: string;
  tools: LLMTool[];
  messages: { role: 'user' | 'assistant'; content: string }[];
}

const MODEL = 'claude-sonnet-5';

/**
 * The output-token ceiling for a reply. Sized with headroom because thinking
 * models (e.g. Gemini's flash line, the current real provider) bill their
 * internal reasoning tokens AGAINST this budget — a small ceiling truncates the
 * JSON answer mid-object, which then fails to parse. Anthropic bills thinking
 * separately, so a generous ceiling is harmless there.
 */
const MAX_OUTPUT_TOKENS = 8192;

function fmtTime(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16);
}

/** The capability registry, serialized as Anthropic tool definitions. */
export function buildTools(ctx: ContextBundle): LLMTool[] {
  const selection = ctx.situation.selection;
  return listCapabilities()
    .filter((c) => ctx.device.apps.includes(c.app))
    .map((c) => {
      const requirement = c.selection
        ? ` Requires >=${c.selection.min} selected object(s) of kind "${c.selection.kind}".`
        : ' Requires no selection.';
      const satisfied = !c.selection
        ? ''
        : selection &&
            selection.kind === c.selection.kind &&
            selection.ids.length >= c.selection.min
          ? ' Currently satisfied by the user selection.'
          : ' NOT currently satisfied.';
      // share-photos has a sharp edge: no payload.recipients silently means
      // "everyone tagged in the photo", not "whoever the request named" — a
      // step whose description mentions one person but omits this field still
      // sends to everyone tagged. Spell that out so the model doesn't infer
      // its own prose is enough.
      const recipientsWarning =
        c.intent === 'share-photos'
          ? ' IMPORTANT: omitting payload.recipients shares with EVERY person tagged in the photo(s), regardless of what this step\'s description says. Whenever the user names a specific person or a people selection is active, you MUST set payload.recipients to just their id(s) — never rely on the description text alone to scope the send.'
          : '';
      return {
        name: c.intent,
        description: `${c.label} — owned by the "${c.app}" app.${requirement}${satisfied}${recipientsWarning}`,
        input_schema: {
          type: 'object',
          properties: {
            ids: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Ids of the objects this action operates on (photo ids, person ids).',
            },
            payload: {
              type: 'object',
              description:
                'Free-form inputs: {text} for send-message, {title} for create-reminder, {message, recipients} overrides for share-photos.',
            },
          },
          required: ['ids'],
        },
      };
    });
}

/**
 * Everything the decider is allowed to know about the world right now — the
 * shared body of every request this module builds. Each builder appends its
 * own response contract after this; keeping the contract OUT of here is what
 * lets chat, plan revision, and strand consolidation reuse one serialization
 * without one task's instructions leaking into another's.
 */
function buildContextLines(ctx: ContextBundle): string[] {
  const { owner, device, state, situation } = ctx;
  const lines: string[] = [];

  lines.push(
    `You are the on-device assistant for ${owner.name} (${owner.id}) inside a simulated phone OS.`,
    `Act ONLY through the provided tools (the phone's capability registry); never invent capabilities.`,
    '',
    '## Situation',
    `- Sim time: ${fmtTime(state.clock)} (the simulation clock, not wall time)`,
    `- Device: ${device.name} (${device.id}) — installed apps: ${device.apps.join(', ')}`,
    `- Open app: ${situation.app ?? 'none'}`,
    situation.selection
      ? `- User selection: ${situation.selection.ids.length} × ${situation.selection.kind} in ${situation.selection.app}: [${situation.selection.ids.join(', ')}]`
      : '- User selection: none',
    '',
    '## Owner traits',
    owner.traits.length ? `- ${owner.traits.join(', ')}` : '- (none)',
    '',
    '## Contacts (derived from the photo graph)',
    ...contactsOf(owner.id).map((c) => `- ${c.name} (${c.id})`),
    '',
    '## Gallery (committed metadata is ground truth; never guess at pixels)',
    ...owner.gallery.map(
      (p) =>
        `- ${p.id}: ${p.date.toISOString().slice(0, 10)} @ ${p.location || '?'} — people: [${p.people.join(', ')}] tags: [${p.tags.join(', ')}]`,
    ),
  );

  const messages = messagesInvolving(state, owner.id).slice(-10);
  lines.push('', '## Recent messages (newest last)');
  if (!messages.length) lines.push('- (none)');
  for (const m of messages) {
    const dir = m.from === owner.id ? 'to' : 'from';
    const who =
      m.from === owner.id
        ? m.to.map((id) => resolvePerson(owner.id, id).name).join(', ')
        : resolvePerson(owner.id, m.from).name;
    const att = m.attachments.length
      ? ` [+${m.attachments.length} photo(s): ${m.attachments.join(', ')}]`
      : '';
    lines.push(`- ${fmtTime(m.at)} ${dir} ${who}: "${m.body}"${att}`);
  }

  const reminders = remindersFor(state, owner.id);
  lines.push('', '## Reminders');
  if (!reminders.length) lines.push('- (none)');
  for (const r of reminders) lines.push(`- ${r.title}`);

  const facts = factsFor(state, owner.id);
  lines.push('', '## Facts the brain has recorded');
  if (!facts.length) lines.push('- (none)');
  for (const f of facts.slice(-5)) lines.push(`- ${f.key} = ${f.value}`);

  const plans = plansFor(state, owner.id).slice(0, 3);
  lines.push('', '## Recent assistant plans');
  if (!plans.length) lines.push('- (none)');
  for (const p of plans) lines.push(`- [${p.outcome}] ${p.goal}`);

  return lines;
}

/**
 * The chat/plan decider's system prompt: the world context plus the
 * ChatReply/PlanStep response contract. Passing `revisingPlan` (the
 * PlanSheet's chat-edit seam) appends a section describing the
 * already-previewed plan under discussion and asks for the same contract
 * back, revised.
 */
export function buildSystemPrompt(
  ctx: ContextBundle,
  revisingPlan?: Plan,
): string {
  const lines = buildContextLines(ctx);

  if (revisingPlan) {
    lines.push(
      '',
      '## Plan under revision (the user is editing this, not starting fresh)',
      JSON.stringify(revisingPlan, null, 2),
      '',
      "The next message asks for a change to THIS plan, not a new one. Return",
      'the same ChatReply/plan JSON contract below, revised: preserve the "id"',
      "of every step you don't change (only a newly-added step needs a new",
      'id), leave unrelated steps untouched, and make "text" a short',
      'confirmation of what changed (e.g. "Now sharing with Sam only."). If',
      "the request doesn't make sense as an edit to this plan, return no plan",
      'and explain why in "text" instead of guessing.',
    );
  }

  lines.push(
    '',
    '## How to respond',
    'Reply with JSON matching ChatReply:',
    '  { "text": string, "plan"?: { "goal": string, "steps": PlanStep[] } }',
    'A PlanStep is { "id": string, "app": string, "description": string,',
    '  "intent"?: <a tool name>, "ids"?: string[], "payload"?: object }.',
    'Steps without "intent" navigate (open the app so the user sees context);',
    'steps with "intent" act, and pause for user approval before committing.',
    'Prefer a plan for imperative requests; plain text for advisory questions.',
  );

  return lines.join('\n');
}

/** Chat history + the new message, as API messages. */
export function buildMessages(
  history: ChatTurn[],
  message: string,
): LLMRequest['messages'] {
  return [
    ...history.map((t) => ({ role: t.role, content: t.text })),
    { role: 'user' as const, content: message },
  ];
}

/** The complete Messages-API request body (minus auth — held server-side in M5). */
export function buildLLMRequest(
  ctx: ContextBundle,
  history: ChatTurn[],
  message: string,
): LLMRequest {
  return {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: buildSystemPrompt(ctx),
    tools: buildTools(ctx),
    messages: buildMessages(history, message),
  };
}

/**
 * The request for a PlanSheet chat edit: same shape as `buildLLMRequest`, but
 * the system prompt describes the plan under revision (see `revisingPlan`
 * above) instead of chat history — a plan edit is a fresh, single-turn ask
 * ("just Sam", "skip the reminder"), not a continued conversation.
 */
export function buildRevisePlanRequest(
  ctx: ContextBundle,
  plan: Plan,
  message: string,
): LLMRequest {
  return {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: buildSystemPrompt(ctx, plan),
    tools: buildTools(ctx),
    messages: buildMessages([], message),
  };
}

/**
 * The request for a strand consolidation: sort the person's loose activity
 * into the ongoing threads it belongs to. No tools — consolidation changes no
 * world state, it only re-describes what already happened, so the model is
 * given nothing it could act with.
 */
export function buildConsolidateRequest(
  ctx: ContextBundle,
  current: Strand[],
): LLMRequest {
  const pending = unassignedItems(ctx.state, ctx.owner.id, current);
  const lines = buildContextLines(ctx);

  lines.push(
    '',
    '## Current threads (the ongoing efforts this person has going)',
    current.length ? JSON.stringify(current, null, 2) : '(none yet)',
    '',
    '## Unfiled activity (every item below is NOT yet in any thread)',
    pending.length
      ? JSON.stringify(
          pending.map((p) => ({
            source: p.source,
            kind: p.kind,
            at: p.at,
            text: p.text,
            refs: p.refs,
          })),
          null,
          2,
        )
      : '(nothing new)',
    '',
    '## How to respond',
    'File each unfiled item into the thread it belongs to. Reply with JSON:',
    '  { "text": string, "strands": Strand[] }',
    'A Strand is { "id": string, "title": string, "summary": string,',
    '  "status": "active"|"dormant"|"done", "icon": string, "items": Item[] }.',
    'An Item is { "source": string, "kind": "note"|"chat"|"plan"|"message"',
    '  |"reminder"|"photo", "at": number, "text": string, "refs": string[] }.',
    '',
    'Rules:',
    '- Return the COMPLETE set: every current thread plus any new ones. A',
    '  thread you leave unchanged must still appear, unchanged.',
    '- NEVER change an existing thread\'s "id", and never drop or reword its',
    '  existing items — you are adding to a record, not rewriting it.',
    '- Copy each filed item\'s "source" VERBATIM. It is the dedupe key; a',
    '  changed source means the item gets folded in again on the next run.',
    '- Only file items from the unfiled list. Do not invent items.',
    '- Start a new thread only when an item genuinely belongs to no existing',
    '  one. Give it a short human title and a fitting emoji icon.',
    '- A "done" thread is finished — do not file new activity into it.',
    '- Make "text" one short sentence on what changed, for the user.',
  );

  return {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: lines.join('\n'),
    tools: [],
    messages: buildMessages([], 'Consolidate my threads.'),
  };
}
