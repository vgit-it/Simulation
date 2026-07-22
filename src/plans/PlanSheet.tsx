import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Sheet } from '../ui';
import { getApp } from '../world';
import type { Plan, Supervision } from './types';

interface PlanSheetProps {
  /** The plan to preview, or null when nothing is pending (sheet hidden). */
  plan: Plan | null;
  /** Run the (possibly step-trimmed) plan; `struck` = steps edited out. */
  onRun: (plan: Plan, supervision: Supervision, struck: number) => void;
  onCancel: () => void;
  /** Ask the brain to revise the plan from a chat message (fire-and-forget). */
  onChatEdit: (message: string) => void;
  /** A revise-plan call (Gemini) is in flight — mock/dry-run resolve instantly. */
  editing: boolean;
  /** The brain's reply to the last chat edit (a confirmation, or why it couldn't apply). */
  lastEditReply: string | null;
}

/**
 * The plan preview: shows the assistant's decomposition as a numbered,
 * app-tagged checklist BEFORE anything runs, so the user sees (and approves)
 * exactly what will happen across which apps. Editable two ways — tap a step
 * to strike it from the run, or say the change in the chat box below the
 * list ("just Sam", "skip the reminder") — both mutate the SAME previewed
 * plan. Every plan runs as `confirm-once` ("Watch it run"): one approval at
 * Run, the phone still walks step-by-step; the non-waivable consent gate
 * (`usePlanRunner`) still pauses a high-stakes or invalid step regardless.
 * This is the plan sibling of ProposalSheet.
 */
export function PlanSheet({
  plan,
  onRun,
  onCancel,
  onChatEdit,
  editing,
  lastEditReply,
}: PlanSheetProps) {
  const lastRef = useRef<Plan | null>(null);
  if (plan) lastRef.current = plan;
  const shown = plan ?? lastRef.current;

  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (plan) setSkipped(new Set());
  }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [chatText, setChatText] = useState('');

  if (!shown) return null;

  const kept = shown.steps.filter((s) => !skipped.has(s.id));
  const appCount = new Set(kept.map((s) => s.app)).size;
  const runnable = kept.some((s) => s.intent);

  function toggleStep(id: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run() {
    if (!shown || !runnable) return;
    onRun({ ...shown, steps: kept }, 'confirm-once', skipped.size);
  }

  function submitChat(e: FormEvent) {
    e.preventDefault();
    const text = chatText.trim();
    if (!text || editing) return;
    onChatEdit(text);
    setChatText('');
  }

  return (
    <Sheet open={plan !== null} onDismiss={onCancel} maxHeightClass="max-h-[85%]">
      <div className="flex max-h-[70vh] flex-col">
        <div className="shrink-0">
          <p className="type-caption text-accent">Assistant · Plan</p>
          <h2 className="type-title mt-1">{shown.goal}</h2>
          <p className="type-body-sm mt-0.5 text-muted">
            {kept.length} step{kept.length === 1 ? '' : 's'}
            {appCount > 1 ? ` across ${appCount} apps` : ''}
            {skipped.size > 0 ? ` · ${skipped.size} skipped` : ''}
            <span className="text-muted/70">
              {' '}
              — tap a step to skip it, or tell it what to change
            </span>
          </p>
        </div>

        <ol className="mt-space-md flex min-h-0 flex-1 flex-col gap-space-sm overflow-y-auto">
          {shown.steps.map((step, i) => {
            const app = getApp(step.app);
            const off = skipped.has(step.id);
            return (
              <li key={step.id}>
                <button
                  onClick={() => toggleStep(step.id)}
                  className={`flex w-full animate-rise items-center gap-space-md rounded-card p-space-md text-left ring-1 transition duration-150 active:scale-[0.99] ${
                    off
                      ? 'bg-bg/30 opacity-50 ring-text/5'
                      : 'bg-bg/60 ring-text/5'
                  }`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span
                    className={`type-label flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      off ? 'bg-text/5 text-muted/50' : 'bg-text/10 text-muted'
                    }`}
                  >
                    {off ? '–' : i + 1}
                  </span>
                  <span className="text-xl">{app.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`type-body block ${off ? 'line-through' : ''}`}
                    >
                      {step.description}
                    </span>
                    <span className="type-caption block text-muted">
                      {app.name}
                      {step.intent ? ' · action' : ''}
                      {off ? ' · skipped' : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-space-md shrink-0">
          {editing ? (
            <div
              aria-label="Updating the plan"
              className="mb-space-sm flex items-center gap-1.5"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-muted/70"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          ) : (
            lastEditReply && (
              <p className="type-body-sm mb-space-sm animate-rise text-muted">
                {lastEditReply}
              </p>
            )
          )}

          <form onSubmit={submitChat} className="flex items-center gap-space-sm">
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Change something — “just Sam”, “skip the reminder”…"
              disabled={editing}
              className="type-body min-w-0 flex-1 rounded-ds-full bg-bg/60 px-space-lg py-2.5 text-text ring-1 ring-text/10 placeholder:text-muted focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              aria-label="Send edit"
              disabled={!chatText.trim() || editing}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/85 text-lg text-white transition duration-150 active:scale-90 disabled:opacity-50"
            >
              ↑
            </button>
          </form>

          <div className="mt-space-lg flex gap-space-md">
            <button
              onClick={onCancel}
              className="type-label flex-1 rounded-ds-full bg-text/10 py-2.5 text-text transition duration-150 ease-out-soft active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={run}
              disabled={!runnable}
              className="type-label flex-1 rounded-ds-full bg-accent py-2.5 text-white transition duration-150 ease-out-soft active:scale-95 disabled:opacity-40"
            >
              Run plan
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
