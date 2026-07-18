import { useMemo, useState, type FormEvent } from 'react';
import { propose, type Proposal } from '../actions';
import { ProposalSheet } from '../actions/ProposalSheet';
import { assembleContext } from '../context';
import { intelligenceFor, type ChatTurn, type Suggestion } from '../intelligence';
import { PlanProgress } from '../plans/PlanProgress';
import { PlanSheet } from '../plans/PlanSheet';
import { usePlanRunner } from '../plans/usePlanRunner';
import type { Plan, Supervision } from '../plans/types';
import { useSession } from '../session';
import { messagesFrom, plansFor, useNow, useStore } from '../state';
import { PillButton, Sheet } from '../ui';
import { getPerson, resolvePerson } from '../world';

/**
 * The persistent assistant: a floating button that opens a sheet of proactive
 * suggestions (one tap -> a Proposal you approve), an open-ended chat that can
 * now return a runnable multi-step Plan, and a running activity feed. Plans
 * execute through the shared runner, which drives the phone app-by-app while a
 * progress HUD narrates the steps.
 */
export function Assistant() {
  const { session } = useSession();
  const { state } = useStore();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [previewPlan, setPreviewPlan] = useState<Plan | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState('');

  const runner = usePlanRunner();

  const owner = getPerson(session.personId);
  const suggestions = useMemo(
    () => intelligenceFor(session.personId).suggestShares(owner.gallery, now),
    [session.personId, owner.gallery, now],
  );
  const activity = messagesFrom(state, session.personId);
  const planRuns = plansFor(state, session.personId);

  function onSuggestion(s: Suggestion) {
    const ctx = assembleContext(session, state, {
      photoIds: s.photos.map((p) => p.id),
    });
    setProposal(propose(s.intent, ctx, s.photos.map((p) => p.id)));
  }

  function onChatSubmit(e: FormEvent) {
    e.preventDefault();
    const message = chatInput.trim();
    if (!message) return;
    const ctx = assembleContext(session, state, {});
    const reply = intelligenceFor(session.personId).respond(ctx, chatHistory, message);
    setChatHistory((h) => [
      ...h,
      { role: 'user', text: message },
      { role: 'assistant', text: reply.text },
    ]);
    setChatInput('');
    // A task-shaped reply carries a plan: close the sheet and preview it so the
    // user can watch it run on the phone.
    if (reply.plan) {
      setPreviewPlan(reply.plan);
      setOpen(false);
    }
  }

  function runPlan(plan: Plan, supervision: Supervision) {
    runner.start(plan, supervision);
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
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-fab transition duration-200 ease-out-soft active:scale-90 ${
            open || runner.active ? 'pointer-events-none scale-0 opacity-0' : 'scale-100 opacity-100'
          }`}
        >
          ✨
          {suggestions.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 animate-pop rounded-full bg-white ring-[3px] ring-accent" />
          )}
        </button>
      </span>

      {runner.active && (
        <PlanProgress active={runner.active} onCancel={runner.cancel} />
      )}

      <Sheet
        open={open}
        onDismiss={() => setOpen(false)}
        dismissLabel="Close assistant"
        maxHeightClass="max-h-[85%]"
      >
        <div className="flex items-center justify-between">
          <h2 className="type-title">✨ Assistant</h2>
          <button
            onClick={() => setOpen(false)}
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
                <span className="text-xl">📷</span>
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
        <p className="type-caption mb-space-sm text-muted/70">
          Try “share these” after selecting photos, or “share this week's photos”.
        </p>
        {chatHistory.length > 0 && (
          <div className="mb-space-sm flex flex-col gap-space-sm">
            {chatHistory.map((turn, i) => (
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
        <form onSubmit={onChatSubmit} className="flex gap-space-sm">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask the assistant..."
            className="type-body-sm min-w-0 flex-1 rounded-ds-full bg-bg/60 px-space-lg py-2 text-text ring-1 ring-text/10 placeholder:text-muted focus:outline-none"
          />
          <PillButton
            variant="accent"
            disabled={!chatInput.trim()}
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
      <PlanSheet
        plan={previewPlan}
        onRun={runPlan}
        onCancel={() => setPreviewPlan(null)}
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
