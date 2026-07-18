import { listCapabilities } from '../../actions';
import type { ContextBundle } from '../../context';
import { factsFor, messagesInvolving, plansFor, remindersFor } from '../../state';
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
      return {
        name: c.intent,
        description: `${c.label} — owned by the "${c.app}" app.${requirement}${satisfied}`,
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

/** Everything the decider is allowed to know, as a deterministic system prompt. */
export function buildSystemPrompt(ctx: ContextBundle): string {
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
    max_tokens: 1024,
    system: buildSystemPrompt(ctx),
    tools: buildTools(ctx),
    messages: buildMessages(history, message),
  };
}
