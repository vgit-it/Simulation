import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { propose, type Proposal } from '../actions';
import { ProposalSheet } from '../actions/ProposalSheet';
import { assembleContext } from '../context';
import {
  intelligenceFor,
  type LLMRequest,
  type Suggestion,
} from '../intelligence';
import { PlanProgress } from '../plans/PlanProgress';
import { PlanSheet } from '../plans/PlanSheet';
import { usePlanRunner, type ActivePlan } from '../plans/usePlanRunner';
import type { Plan, Supervision } from '../plans/types';
import { useSession } from '../session';
import { useAssistantControl } from './control';
import { chatHistoryFor, messagesFrom, plansFor, useStore } from '../state';
import {
  EXIT,
  PillButton,
  Sheet,
  THINKING_BEAT_MS,
  prefersReducedMotion,
  useMountTransition,
} from '../ui';
import { resolvePerson } from '../world';

/**
 * The persistent assistant: a floating button that opens a sheet of proactive
 * suggestions (one tap -> a Proposal you approve), an open-ended chat that can
 * now return a runnable multi-step Plan, and a running activity feed. Plans
 * execute through the shared runner, which drives the phone app-by-app while a
 * progress HUD narrates the steps.
 *
 * Conversations are threads: the sheet is bound to the AssistantControl
 * session — the FAB mints a fresh one (empty conversation), the Assistant app
 * resumes an existing one — and every chat turn is stamped with its id.
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

  // Switching conversations resets the transient chrome: a lingering dry-run
  // card or typing beat belongs to the thread that produced it.
  useEffect(() => {
    setLastRequest(null);
    setThinking(false);
    clearTimeout(thinkingTimer.current);
  }, [control.sessionId]);

  // Suggestions are situated: the brain reads the runtime log through the
  // context (already-shared photos drop out; inbound shares surface a reply).
  const suggestions = useMemo(() => {
    const ctx = assembleContext(session, state, {});
    return intelligenceFor(session.personId).suggest(ctx);
  }, [session, state]);
  const activity = messagesFrom(state, session.personId);
  const planRuns = plansFor(state, session.personId);
  // Chat history is event-log state, scoped to the OPEN conversation thread: a
  // freshly minted session id matches no turns, so the FAB always starts a
  // clean conversation; resuming a thread from the Assistant app shows its
  // history (and feeds it to the brain).
  const chatHistory = chatHistoryFor(
    state,
    session.personId,
    control.sessionId ?? undefined,
  );
  // While the thinking beat runs, the just-dispatched assistant reply stays
  // hidden behind the typing dots (the log already has it — reveal only).
  const visibleHistory =
    thinking && chatHistory.at(-1)?.role === 'assistant'
      ? chatHistory.slice(0, -1)
      : chatHistory;

  function onSuggestion(s: Suggestion) {
    const ctx = assembleContext(session, state, {});
    setProposal(propose(s.intent, ctx, s.ids, s.payload));
  }

  function onChatSubmit(e: FormEvent) {
    e.preventDefault();
    const message = chatInput.trim();
    const thread = control.sessionId;
    if (!message || !thread) return;
    const ctx = assembleContext(session, state, {});
    const reply = intelligenceFor(session.personId).respond(
      ctx,
      chatHistory.map((t) => ({ role: t.role, text: t.text })),
      message,
    );
    const at = state.clock;
    const person = session.personId;
    dispatch({
      type: 'ChatMessage',
      at,
      person,
      role: 'user',
      text: message,
      session: thread,
    });
    dispatch({
      type: 'ChatMessage',
      at,
      person,
      role: 'assistant',
      text: reply.text,
      session: thread,
    });
    setChatInput('');
    // A task-shaped reply carries a plan. PlanProposed lands BEFORE any
    // approval (and before the reveal beat), so declined plans leave a
    // telemetry trail and the log never waits on animation.
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
    // Everything above is committed; now pace the on-screen reveal only —
    // typing dots for a beat, then the reply (and plan preview / dry-run
    // payload) appears.
    setThinking(true);
    clearTimeout(thinkingTimer.current);
    thinkingTimer.current = setTimeout(
      () => {
        setThinking(false);
        if (reply.llmRequest) setLastRequest(reply.llmRequest);
        if (reply.plan) {
          setPreviewPlan(reply.plan);
          control.close();
        }
      },
      prefersReducedMotion() ? 0 : THINKING_BEAT_MS,
    );
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

  return (
    <>
      {/* Entrance pop lives on the wrapper so its fill-mode can't pin the
          button's transform, which the open/close scale toggle animates. */}
      <span
        className="absolute bottom-24 right-5 z-20 block animate-pop"
        style={{ animationDelay: '350ms' }}
      >
        <button
          onClick={() => control.open()}
          aria-label="Open assistant"
          className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-fab transition duration-200 ease-out-soft active:scale-90 ${
            open || runner.active ? 'pointer-events-none scale-0 opacity-0' : 'scale-100 opacity-100'
          }`}
        >
          {/* Beacon halo: the assistant has something for you. */}
          {suggestions.length > 0 && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-halo rounded-full border-2 border-accent"
            />
          )}
          ✨
          {suggestions.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 animate-pop rounded-full bg-white ring-[3px] ring-accent" />
          )}
        </button>
      </span>

      {hud.mounted && (runner.active ?? lastRunRef.current) && (
        <PlanProgress
          active={(runner.active ?? lastRunRef.current)!}
          closing={hud.closing}
          onCancel={runner.cancel}
        />
      )}

      <Sheet
        open={open}
        onDismiss={control.close}
        dismissLabel="Close assistant"
        maxHeightClass="max-h-[85%]"
      >
        <div className="flex items-center justify-between">
          <h2 className="type-title">
            {/* The breathe reads as "listening" while the sheet awaits input. */}
            <span className="inline-block animate-breathe">✨</span> Assistant
          </h2>
          <button
            onClick={control.close}
            className="type-label rounded-ds-full bg-text/10 px-space-md py-1 text-muted transition duration-150 active:scale-95"
          >
            Close
          </button>
        </div>

        <h3 className="type-caption mb-space-sm mt-space-lg text-muted">
          Suggestions
        </h3>
        {suggestions.length === 0 ? (
          <p className="type-body-sm text-muted">Nothing to suggest right now.</p>
        ) : (
          <div className="flex flex-col gap-space-sm">
            {suggestions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => onSuggestion(s)}
                className="flex animate-rise items-center gap-space-md rounded-card bg-bg/60 p-space-md text-left ring-1 ring-text/5 transition duration-150 active:scale-[0.98]"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="text-xl">{s.icon}</span>
                <span className="min-w-0">
                  <span className="type-body block font-medium">{s.title}</span>
                  {s.subtitle && (
                    <span className="type-body-sm block truncate text-muted">
                      {s.subtitle}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        <h3 className="type-caption mb-space-sm mt-space-xl text-muted">Ask</h3>
        {chatHistory.length === 0 && (
          <p className="type-caption mb-space-sm text-muted/70">
            New conversation — try “share these” after selecting photos, or
            “share this week's photos”.
          </p>
        )}
        {visibleHistory.length > 0 && (
          <div className="mb-space-sm flex flex-col gap-space-sm">
            {visibleHistory.map((turn, i) => (
              <div
                key={i}
                className={`flex animate-rise flex-col ${
                  turn.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`type-body max-w-[85%] rounded-ds-md px-3.5 py-2 ${
                    turn.role === 'user'
                      ? 'rounded-br-ds-xs bg-accent text-white'
                      : 'rounded-bl-ds-xs bg-bg/60 text-text ring-1 ring-text/5'
                  }`}
                >
                  {turn.text}
                </div>
              </div>
            ))}
          </div>
        )}
        {thinking && (
          <div className="mb-space-sm flex animate-rise items-start">
            <div
              aria-label="Assistant is thinking"
              className="flex items-center gap-1 rounded-ds-md rounded-bl-ds-xs bg-bg/60 px-3.5 py-3 ring-1 ring-text/5"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-muted"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        {lastRequest && (
          <div className="mb-space-sm animate-rise rounded-card bg-bg/60 p-space-md ring-1 ring-accent/30">
            <p className="type-caption text-accent">
              📤 Assembled LLM request (dry run — nothing was sent)
            </p>
            <p className="type-caption mt-1 text-muted">
              model: {lastRequest.model} · max_tokens: {lastRequest.max_tokens}
            </p>
            <p className="type-caption mb-1 mt-space-sm text-muted">system</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-ds-xs bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-text/80">
              {lastRequest.system}
            </pre>
            <p className="type-caption mb-1 mt-space-sm text-muted">
              tools ({lastRequest.tools.length})
            </p>
            <pre className="max-h-40 overflow-auto rounded-ds-xs bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-text/80">
              {JSON.stringify(lastRequest.tools, null, 2)}
            </pre>
            <p className="type-caption mb-1 mt-space-sm text-muted">
              messages ({lastRequest.messages.length})
            </p>
            <pre className="max-h-40 overflow-auto rounded-ds-xs bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-text/80">
              {JSON.stringify(lastRequest.messages, null, 2)}
            </pre>
          </div>
        )}
        <form onSubmit={onChatSubmit} className="flex gap-space-sm">
          <div className="relative min-w-0 flex-1">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask the assistant..."
              disabled={thinking}
              className="type-body-sm w-full rounded-ds-full bg-bg/60 px-space-lg py-2 text-text ring-1 ring-text/10 transition duration-150 placeholder:text-muted focus:outline-none focus:ring-accent/40 disabled:opacity-60"
            />
            {/* Idle pulse: the empty input gently glows while awaiting a request. */}
            {!chatInput && !thinking && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 animate-breathe rounded-ds-full ring-1 ring-accent/40"
              />
            )}
          </div>
          <PillButton
            variant="accent"
            disabled={!chatInput.trim() || thinking}
            className="shrink-0"
          >
            Send
          </PillButton>
        </form>

        <h3 className="type-caption mb-space-sm mt-space-xl text-muted">
          Recent activity
        </h3>
        {activity.length === 0 && planRuns.length === 0 ? (
          <p className="type-body-sm text-muted">No activity yet.</p>
        ) : (
          <div className="flex flex-col gap-space-sm">
            {planRuns.map((run) => (
              <div
                key={run.planId}
                className="animate-rise rounded-card bg-bg/60 p-space-md ring-1 ring-text/5"
              >
                <p className="type-caption text-accent">
                  ✨ Plan · {run.outcome} · {run.steps} steps
                  {run.struck ? ` · ${run.struck} struck` : ''}
                  {run.supervision ? ` · ${run.supervision}` : ''}
                </p>
                <p className="type-body-sm mt-0.5">{run.goal}</p>
              </div>
            ))}
            {[...activity].reverse().map((m, i) => {
              const names = m.to
                .map((id) => resolvePerson(session.personId, id).name)
                .join(', ');
              return (
                <div
                  key={m.id}
                  className="animate-rise rounded-card bg-bg/60 p-space-md ring-1 ring-text/5"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <p className="type-caption text-muted">To {names}</p>
                  <p className="type-body-sm mt-0.5">{m.body}</p>
                  {m.attachments.length > 0 && (
                    <p className="type-caption mt-1 text-accent">
                      📎 {m.attachments.length} photo
                      {m.attachments.length === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Sheet>

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
