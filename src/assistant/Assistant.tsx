import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { propose, type Proposal } from '../actions';
import { ProposalSheet } from '../actions/ProposalSheet';
import { assembleContext } from '../context';
import {
  intelligenceFor,
  type ChatReply,
  type LLMRequest,
  type Suggestion,
} from '../intelligence';
import { PlanProgress } from '../plans/PlanProgress';
import { PlanSheet } from '../plans/PlanSheet';
import { usePlanRunner, type ActivePlan } from '../plans/usePlanRunner';
import type { Plan, Supervision } from '../plans/types';
import { useSession } from '../session';
import { useAssistantControl } from './control';
import { chatHistoryFor, useStore } from '../state';
import {
  EXIT,
  OverlayLayer,
  THINKING_BEAT_MS,
  prefersReducedMotion,
  useMountTransition,
} from '../ui';

/**
 * The invoked assistant: an ambient bottom surface, not a full sheet. Invoking
 * (press-and-hold the nav bar's home button) raises a gradient glow with the
 * top suggestion as a hint pill and
 * an auto-focused input; once a reply exists, a large themed card shows it.
 * Only the LATEST assistant response is ever visible — the running thread
 * lives in the event log and is readable in the Assistant app, but the
 * invoked experience always faces forward. Plans still execute through the
 * shared runner (preview sheet -> phone walkthrough -> progress HUD).
 *
 * Conversations are threads: the surface is bound to the AssistantControl
 * session — a held home button mints a fresh one (empty conversation), the
 * Assistant app resumes an existing one — and every chat turn is stamped with
 * its id.
 */
export function Assistant() {
  const { session } = useSession();
  const { state, dispatch } = useStore();
  const control = useAssistantControl();
  const open = control.sessionId !== null;
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [previewPlan, setPreviewPlan] = useState<Plan | null>(null);
  const [chatInput, setChatInput] = useState('');
  // The dry-run brain's assembled API payload (shown instead of an answer).
  const [lastRequest, setLastRequest] = useState<LLMRequest | null>(null);
  // Presentation-only "thinking" beat: the reply is already computed AND
  // dispatched (state correctness first) — this just paces its on-screen
  // reveal behind a typing indicator, so answering reads as an act.
  const [thinking, setThinking] = useState(false);
  const thinkingTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(thinkingTimer.current), []);

  const runner = usePlanRunner();
  // Keep the last plan rendered through the HUD's exit (completion beat + fade).
  const lastRunRef = useRef<ActivePlan | null>(null);
  if (runner.active) lastRunRef.current = runner.active;
  const hud = useMountTransition(Boolean(runner.active), EXIT.hud);
  const surface = useMountTransition(open, EXIT.sheet);
  useEffect(() => {
    if (open && surface.mounted && !thinking) inputRef.current?.focus();
  }, [open, surface.mounted, thinking]);

  // Switching conversations resets the transient chrome: a lingering dry-run
  // card or typing beat belongs to the thread that produced it.
  useEffect(() => {
    setLastRequest(null);
    setThinking(false);
    clearTimeout(thinkingTimer.current);
  }, [control.sessionId]);

  // The input takes focus on invoke — ask-first is the whole gesture — and
  // again when a thinking beat releases it. Keyed on the surface's MOUNTED
  // state (not just `open`): the input enters the DOM one render after open
  // flips, so an open-keyed effect would fire before it exists.
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggestions are situated: the brain reads the runtime log through the
  // context. The invoked surface shows only the TOP one, as the hint pill.
  const suggestions = useMemo(() => {
    const ctx = assembleContext(session, state, {});
    return intelligenceFor(session.personId).suggest(ctx);
  }, [session, state]);
  const hint = suggestions[0] ?? null;

  // Chat history is event-log state, scoped to the OPEN conversation thread: a
  // freshly minted session id matches no turns, so a fresh invoke starts a
  // clean conversation; resuming a thread from the Assistant app feeds its
  // history to the brain — but the surface only ever SHOWS the latest reply.
  const chatHistory = chatHistoryFor(
    state,
    session.personId,
    control.sessionId ?? undefined,
  );
  const latestReply =
    chatHistory.filter((t) => t.role === 'assistant').at(-1) ?? null;
  // No response yet -> the slim invoke bar; a response (or the beat before
  // one) -> the card.
  const showCard = thinking || latestReply !== null;

  function onSuggestion(s: Suggestion) {
    const ctx = assembleContext(session, state, {});
    setProposal(propose(s.intent, ctx, s.ids, s.payload));
  }

  async function onChatSubmit(e: FormEvent) {
    e.preventDefault();
    const message = chatInput.trim();
    const thread = control.sessionId;
    if (!message || thread === null || thinking) return;
    const ctx = assembleContext(session, state, {});
    const at = state.clock;
    const person = session.personId;
    const history = chatHistory.map((t) => ({ role: t.role, text: t.text }));

    // Commit the user's turn and clear the box immediately — the reply is
    // async (a real provider awaits the network), so the input can't wait on
    // it. Typing dots show while we resolve.
    dispatch({
      type: 'ChatMessage',
      at,
      person,
      role: 'user',
      text: message,
      session: thread,
    });
    setChatInput('');
    setThinking(true);

    // Pace the reveal: race the reply against a minimum "thinking beat" so the
    // (instant) mock still reads as an act, while a slow network call just
    // takes as long as it takes. Reduced motion collapses the beat to 0.
    const beat = new Promise<void>((resolve) => {
      clearTimeout(thinkingTimer.current);
      thinkingTimer.current = setTimeout(
        resolve,
        prefersReducedMotion() ? 0 : THINKING_BEAT_MS,
      );
    });

    let reply: ChatReply;
    try {
      [reply] = await Promise.all([
        intelligenceFor(person).respond(ctx, history, message),
        beat,
      ]);
    } catch (err) {
      // One friendly path for every failure: unreachable network, a cut-off
      // (truncated) response, a malformed reply. Never a stack trace or a raw
      // model blob — the reason rides along, but the framing stays calm.
      reply = {
        text: `Sorry — I couldn't complete that request. ${
          err instanceof Error ? err.message : String(err)
        }`,
      };
    }

    setThinking(false);
    dispatch({
      type: 'ChatMessage',
      at,
      person,
      role: 'assistant',
      text: reply.text,
      session: thread,
    });
    // A task-shaped reply carries a plan. PlanProposed lands before approval so
    // declined plans still leave a telemetry trail.
    if (reply.plan) {
      dispatch({
        type: 'PlanProposed',
        at,
        person,
        planId: reply.plan.id,
        goal: reply.plan.goal,
        steps: reply.plan.steps.length,
      });
    }
    if (reply.llmRequest) setLastRequest(reply.llmRequest);
    if (reply.plan) {
      setPreviewPlan(reply.plan);
      control.close();
    }
  }

  function runPlan(plan: Plan, supervision: Supervision, struck: number) {
    runner.start(plan, supervision, struck);
    setPreviewPlan(null);
  }

  /** Dismissing the preview declines the plan — recorded, not just closed. */
  function declinePlan() {
    if (previewPlan) {
      dispatch({
        type: 'PlanCompleted',
        at: state.clock,
        person: session.personId,
        planId: previewPlan.id,
        outcome: 'declined',
      });
    }
    setPreviewPlan(null);
  }

  // Shared by both surface states: the hint pill + the ask row.
  const askControls = (
    <>
      {hint && (
        <button
          onClick={() => onSuggestion(hint)}
          className="type-body-sm mb-space-md w-fit animate-rise rounded-ds-full bg-surface/80 px-space-lg py-2 text-left text-text ring-1 ring-text/10 backdrop-blur transition duration-150 active:scale-95"
        >
          {hint.title}
        </button>
      )}
      <form onSubmit={onChatSubmit} className="flex items-center gap-space-sm">
        <input
          ref={inputRef}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="How can I help?"
          disabled={thinking}
          className="type-body min-w-0 flex-1 rounded-ds-full bg-text/90 px-space-lg py-3 text-bg placeholder:text-bg/50 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!chatInput.trim() || thinking}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-xl text-white transition duration-150 active:scale-90 disabled:opacity-50"
        >
          ↑
        </button>
      </form>
    </>
  );

  return (
    <>
      {hud.mounted && (runner.active ?? lastRunRef.current) && (
        <PlanProgress
          active={(runner.active ?? lastRunRef.current)!}
          closing={hud.closing}
          onCancel={runner.cancel}
        />
      )}

      {/* The invoked surface: glow bar first, response card once a reply
          exists. Tapping anywhere outside dismisses (no chrome, per design). */}
      {surface.mounted && (
        <OverlayLayer>
          <div className="absolute inset-0 z-30 flex flex-col justify-end">
            <button
              aria-label="Close assistant"
              onClick={control.close}
              className={`absolute inset-0 cursor-default ${
                surface.closing ? 'animate-fade-out' : 'animate-fade-in'
              }`}
            />

            {showCard ? (
              /* Response card: themed accent-tinted surface, latest reply only. */
              <div
                className={`relative m-space-md flex max-h-[72%] flex-col rounded-screen bg-[color-mix(in_oklab,var(--sim-accent)_30%,var(--sim-surface))] p-space-xl shadow-sheet ${
                  surface.closing ? 'animate-slide-down' : 'animate-slide-up'
                }`}
              >
                <div className="min-h-0 flex-1 overflow-y-auto pb-space-lg pt-space-lg">
                  {thinking ? (
                    <div
                      aria-label="Assistant is thinking"
                      className="flex items-center gap-1.5 py-space-md"
                    >
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-2 w-2 animate-dot-bounce rounded-full bg-text/70"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <>
                      <p
                        role="status"
                        className="type-headline animate-rise whitespace-pre-line text-text"
                      >
                        {latestReply?.text}
                      </p>
                      {lastRequest && (
                        <div className="mt-space-lg animate-rise">
                          <p className="type-caption text-text/70">
                            📤 Assembled LLM request (dry run — nothing was
                            sent) · model: {lastRequest.model} · max_tokens:{' '}
                            {lastRequest.max_tokens}
                          </p>
                          <p className="type-caption mb-1 mt-space-sm text-text/70">
                            system
                          </p>
                          <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded-ds-xs bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-text/80">
                            {lastRequest.system}
                          </pre>
                          <p className="type-caption mb-1 mt-space-sm text-text/70">
                            tools ({lastRequest.tools.length})
                          </p>
                          <pre className="max-h-36 overflow-auto rounded-ds-xs bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-text/80">
                            {JSON.stringify(lastRequest.tools, null, 2)}
                          </pre>
                          <p className="type-caption mb-1 mt-space-sm text-text/70">
                            messages ({lastRequest.messages.length})
                          </p>
                          <pre className="max-h-36 overflow-auto rounded-ds-xs bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-text/80">
                            {JSON.stringify(lastRequest.messages, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-col">{askControls}</div>
              </div>
            ) : (
              /* Invoke bar: an ambient accent glow rising from the bottom
                 edge, hint pill + focused input floating over it. */
              <div
                className={`relative ${
                  surface.closing ? 'animate-slide-down' : 'animate-slide-up'
                }`}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-80"
                >
                  <div className="absolute inset-0 -hue-rotate-30 bg-[radial-gradient(110%_100%_at_25%_100%,var(--sim-accent)_0%,transparent_62%)] opacity-70" />
                  <div className="absolute inset-0 hue-rotate-60 bg-[radial-gradient(110%_100%_at_85%_100%,var(--sim-accent)_0%,transparent_58%)] opacity-60" />
                </div>
                <div className="relative flex flex-col px-space-lg pb-space-xl pt-space-2xl">
                  {askControls}
                </div>
              </div>
            )}
          </div>
        </OverlayLayer>
      )}

      {/* Plan preview (chat -> plan). Approve to run it on the phone. */}
      <PlanSheet plan={previewPlan} onRun={runPlan} onCancel={declinePlan} />

      {/* Suggestion / direct-share proposals. */}
      <ProposalSheet
        proposal={proposal}
        onSent={() => setProposal(null)}
        onCancel={() => setProposal(null)}
      />

      {/* A running plan's action step surfaces its proposal here; committing it
          advances the plan to the next step. */}
      <ProposalSheet
        proposal={runner.active?.proposal ?? null}
        onSent={runner.onProposalSent}
        onCancel={runner.cancel}
      />
    </>
  );
}
