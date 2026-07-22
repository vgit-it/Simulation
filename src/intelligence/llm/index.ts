import type { ContextBundle } from '../../context';
import type { Plan } from '../../plans/types';
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
import { buildLLMRequest, buildRevisePlanRequest } from './prompt';

/**
 * The LLM-backed brain, in DRY-RUN mode: it assembles the exact Anthropic
 * Messages API request the real provider will send (system prompt from the
 * ContextBundle, the capability registry as tools, chat history as messages)
 * and — instead of calling the network — returns that payload on the reply
 * for the UI to display. No key, no endpoint, no tokens.
 *
 * Everything that isn't the decider seam (grouping, deterministic drafts,
 * situated suggestions) delegates to the mock brain so the phone remains fully
 * usable in this mode. When the real connection lands (M5), `respond` swaps
 * its tail — send `buildLLMRequest(...)`, parse the ChatReply/Plan JSON — and
 * nothing upstream changes.
 */
class DryRunPersonIntelligence implements PersonIntelligence {
  constructor(
    readonly personId: string,
    private readonly delegate: PersonIntelligence,
  ) {}

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
    const llmRequest = buildLLMRequest(ctx, history, message);
    const toolNames = llmRequest.tools.map((t) => t.name).join(', ');
    return {
      text:
        `🔌 LLM dry run — no call was made. This is exactly what would be ` +
        `sent (system prompt: ${llmRequest.system.length} chars, ` +
        `tools: ${toolNames || 'none'}, ` +
        `messages: ${llmRequest.messages.length}).`,
      llmRequest,
    };
  }

  async revisePlan(
    ctx: ContextBundle,
    plan: Plan,
    message: string,
  ): Promise<{ reply: string; plan: Plan | null }> {
    const req = buildRevisePlanRequest(ctx, plan, message);
    return {
      reply:
        `🔌 LLM dry run — no call was made. This is exactly what would be ` +
        `sent to revise the plan (system prompt: ${req.system.length} chars, ` +
        `messages: ${req.messages.length}).`,
      plan: null,
    };
  }
}

export class LLMIntelligence implements IntelligenceProvider {
  private brains = new Map<string, PersonIntelligence>();

  constructor(private readonly fallback: IntelligenceProvider) {}

  for(personId: string): PersonIntelligence {
    let brain = this.brains.get(personId);
    if (!brain) {
      brain = new DryRunPersonIntelligence(personId, this.fallback.for(personId));
      this.brains.set(personId, brain);
    }
    return brain;
  }
}
