import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  parseSlotAnswer,
  propose,
  type Candidate,
  type Proposal,
} from '../actions';
import { answerResolve, beginResolve, type ResolveState } from '../tasks';
import { resolvePerson } from '../world';
import { ChoicePicker, pickerFor } from './pickers/registry';
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
  // The conversation thread that produced `previewPlan` — captured because
  // `proposePlan` closes the ambient surface (nulling `control.sessionId`)
  // right after opening the preview, so a later chat edit inside the
  // PlanSheet still has somewhere to log its turns.
  const [planSession, setPlanSession] = useState<string | null>(null);
  // A chat edit to the previewed plan (PlanSheet's own chat box) in flight,
  // and the brain's reply to the last one (a confirmation, or why it
  // couldn't apply) — shown in the sheet's status strip.
  const [editingPlan, setEditingPlan] = useState(false);
  const [lastEditReply, setLastEditReply] = useState<string | null>(null);
  // The input-resolution stack (Stage 3's interpreter): the assistant asked for
  // a slot it can't bind silently — a `confirm` chip, an `elicit` picker, or a
  // disambiguation `choice` pushed over an elicit — and is waiting on the user.
  // The top frame is the current ask. Null when nothing is being resolved;
  // cleared once the plan is fully specified (→ preview) or the conversation
  // resets.
  const [resolver, setResolver] = useState<ResolveState | null>(null);
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
    setResolver(null);
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

  /** Record the plan as proposed (telemetry) and open its preview. */
  function proposePlan(plan: Plan, at: number, person: string) {
    dispatch({
      type: 'PlanProposed',
      at,
      person,
      planId: plan.id,
      goal: plan.goal,
      steps: plan.steps.length,
    });
    setPlanSession(control.sessionId);
    setLastEditReply(null);
    setPreviewPlan(plan);
    control.close();
  }

  /**
   * A chat edit inside the PlanSheet ("just Sam", "skip the reminder") — an
   * alternative to tapping a step to strike it. Logs both turns into the
   * thread that produced the plan (chat history stays event-log state even
   * for an edit made after the ambient surface closed), asks the brain to
   * revise the already-previewed plan, and swaps the preview in place when it
   * can. An edit the brain couldn't apply just surfaces its explanation —
   * the previewed plan is untouched.
   */
  async function editPreviewPlan(message: string) {
    if (!previewPlan) return;
    const ctx = assembleContext(session, state, {});
    const person = session.personId;
    const thread = planSession;

    if (thread !== null) {
      dispatch({
        type: 'ChatMessage',
        at: state.clock,
        person,
        role: 'user',
        text: message,
        session: thread,
      });
    }

    setEditingPlan(true);
    let result: { reply: string; plan: Plan | null };
    try {
      result = await intelligenceFor(person).revisePlan(ctx, previewPlan, message);
    } catch (err) {
      result = {
        reply: `Sorry — I couldn't apply that. ${
          err instanceof Error ? err.message : String(err)
        }`,
        plan: null,
      };
    }
    setEditingPlan(false);
    setLastEditReply(result.reply);

    if (thread !== null) {
      dispatch({
        type: 'ChatMessage',
        at: state.clock,
        person,
        role: 'assistant',
        text: result.reply,
        session: thread,
      });
    }

    if (result.plan) setPreviewPlan(result.plan);
  }

  /** Dispatch an assistant chat turn into the open thread (sim-clocked). */
  function assistantSay(text: string) {
    const thread = control.sessionId;
    if (thread === null) return;
    dispatch({
      type: 'ChatMessage',
      at: state.clock,
      person: session.personId,
      role: 'assistant',
      text,
      session: thread,
    });
  }

  /** Render a candidate for the confirm chip (person ids → names, else text). */
  function describeCandidate(c: Candidate | null | undefined): string {
    const v = c?.value;
    if (Array.isArray(v)) {
      return v.map((id) => resolvePerson(session.personId, String(id)).name).join(', ');
    }
    return String(v ?? '');
  }

  /**
   * Resume the resolver with the answer to the current ask, as candidate(s) —
   * from a tapped confirm chip, a structured picker, a disambiguation choice, or
   * a parsed typed answer (one path for all). The interpreter binds a single
   * value + advances, or pushes a choice frame for an ambiguous one. Pure
   * slot-filling — no brain call.
   */
  function applyAnswer(cands: Candidate[]) {
    if (!resolver) return;
    const ctx = assembleContext(session, state, {});
    const result = answerResolve(resolver, ctx, cands);
    if (result.status === 'resolving') {
      assistantSay(result.ask.prompt);
      setResolver(result.state);
      return;
    }
    assistantSay("Got it — here's the plan.");
    setResolver(null);
    proposePlan(result.plan, state.clock, session.personId);
  }

  /** A picker/choice/confirm selection answers the current ask with one value. */
  const onPick = (c: Candidate) => applyAnswer([c]);

  async function onChatSubmit(e: FormEvent) {
    e.preventDefault();
    const message = chatInput.trim();
    const thread = control.sessionId;
    if (!message || thread === null || thinking) return;
    const ctx = assembleContext(session, state, {});
    const at = state.clock;
    const person = session.personId;

    // Commit the user's turn and clear the box immediately.
    dispatch({
      type: 'ChatMessage',
      at,
      person,
      role: 'user',
      text: message,
      session: thread,
    });
    setChatInput('');

    // Clarification branch: this turn answers the assistant's current ask (a
    // confirm the user overrode by typing, an outright elicit, or a choice).
    // Parse the answer into candidate(s) and hand them to the interpreter — one
    // binds + advances, many push a disambiguation, zero re-asks. No brain call.
    if (resolver) {
      const top = resolver.frames[resolver.frames.length - 1];
      const step = resolver.plan.steps[top.stepIndex];
      const cands = parseSlotAnswer(
        step.intent!,
        top.slot,
        message,
        ctx,
        step.ids ?? [],
        step.payload ?? {},
      );
      // Nothing parseable → acknowledge + re-ask (not a silent no-op).
      if (cands.length === 0) {
        assistantSay(`I didn't catch that. ${top.slot.prompt}`);
        return;
      }
      applyAnswer(cands);
      return;
    }

    // Fresh request: ask the brain. The reply is async (a real provider awaits
    // the network), so the input can't wait on it — typing dots show meanwhile.
    setThinking(true);
    const history = chatHistory.map((t) => ({ role: t.role, text: t.text }));

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

    // Kick off input resolution for a plan reply: the interpreter binds what's
    // confident and surfaces the first gap as an ask (a confirm chip / picker /
    // open question), or reports the plan is fully specified. An advisory
    // (no-plan) reply just speaks its text.
    const result = reply.plan ? beginResolve(reply.plan, ctx, message) : null;
    if (reply.llmRequest) setLastRequest(reply.llmRequest);
    if (result?.status === 'resolving') {
      assistantSay(result.ask.prompt);
      setResolver(result.state);
    } else {
      assistantSay(reply.text);
      if (result?.status === 'done') proposePlan(result.plan, at, person);
    }
  }

  function runPlan(plan: Plan, supervision: Supervision, struck: number) {
    runner.start(plan, supervision, struck);
    setPreviewPlan(null);
    setPlanSession(null);
    setLastEditReply(null);
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
    setPlanSession(null);
    setLastEditReply(null);
  }

  // The current ask is the top frame of the resolver stack. What the top of the
  // surface shows, in priority order:
  //  - a disambiguation choice row (a choice frame),
  //  - a structured picker for an elicit whose value kind has one,
  //  - a pre-filled confirm chip (the medium band),
  //  - else the top suggestion hint (only when nothing is being resolved).
  const ask = resolver ? resolver.frames[resolver.frames.length - 1] : null;
  const pendingChoice = ask?.kind === 'choice' ? ask : null;
  const pendingConfirm =
    ask?.kind === 'elicit' && ask.band === 'confirm' && ask.candidate ? ask : null;
  const PickerEl =
    ask?.kind === 'elicit' && ask.band === 'elicit' ? pickerFor(ask.slot.valueKind) : null;

  const askControls = (
    <>
      {pendingChoice ? (
        <ChoicePicker
          ownerId={session.personId}
          candidates={pendingChoice.alternatives}
          onPick={onPick}
        />
      ) : PickerEl ? (
        <PickerEl ownerId={session.personId} slot={ask!.slot} onPick={onPick} />
      ) : pendingConfirm ? (
        <button
          onClick={() => applyAnswer([pendingConfirm.candidate!])}
          className="type-body-sm mb-space-md w-fit animate-rise rounded-ds-full bg-accent/85 px-space-lg py-2 text-left text-white ring-1 ring-white/20 backdrop-blur transition duration-150 active:scale-95"
        >
          ✓ {describeCandidate(pendingConfirm.candidate)}
        </button>
      ) : hint && !resolver ? (
        <button
          onClick={() => onSuggestion(hint)}
          className="type-body-sm mb-space-md w-fit animate-rise rounded-ds-full bg-surface/80 px-space-lg py-2 text-left text-text ring-1 ring-text/10 backdrop-blur transition duration-150 active:scale-95"
        >
          {hint.title}
        </button>
      ) : null}
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
          exists. Tapping anywhere outside dismisses (no chrome, per design) —
          EXCEPT while the resolver is waiting on an answer: the assistant asked
          a question, so an outside tap must not silently discard the half-built
          plan (that would strand the answer as a fresh request in a new
          thread). Answer it, or switch POV to abandon. */}
      {surface.mounted && (
        <OverlayLayer>
          <div className="absolute inset-0 z-30 flex flex-col justify-end">
            <button
              aria-label="Close assistant"
              onClick={() => {
                if (!resolver) control.close();
              }}
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
                        className="type-title animate-rise whitespace-pre-line text-text"
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

      {/* Plan preview (chat -> plan). Approve to run it on the phone, or
          revise it from the sheet's own chat box first. */}
      <PlanSheet
        plan={previewPlan}
        onRun={runPlan}
        onCancel={declinePlan}
        onChatEdit={editPreviewPlan}
        editing={editingPlan}
        lastEditReply={lastEditReply}
      />

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
