import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../ui';
import { getApp } from '../world';
import type { Plan, Supervision } from './types';

interface PlanSheetProps {
  /** The plan to preview, or null when nothing is pending (sheet hidden). */
  plan: Plan | null;
  /** Run the (possibly step-trimmed) plan at the chosen supervision level. */
  onRun: (plan: Plan, supervision: Supervision) => void;
  onCancel: () => void;
}

const LEVELS: { id: Supervision; label: string; hint: string }[] = [
  { id: 'confirm-each', label: 'Ask each time', hint: 'Approve every action' },
  { id: 'confirm-once', label: 'Watch it run', hint: 'One approval, watch it work' },
  { id: 'auto', label: 'Just do it', hint: 'Instant, see the receipt' },
];

/**
 * The plan preview: shows the assistant's decomposition as a numbered,
 * app-tagged checklist BEFORE anything runs, so the user sees (and approves)
 * exactly what will happen across which apps. Editable in two ways: tap a step
 * to strike it from the run, and pick a supervision level — the trust dial —
 * before approving. This is the plan sibling of ProposalSheet.
 */
export function PlanSheet({ plan, onRun, onCancel }: PlanSheetProps) {
  const lastRef = useRef<Plan | null>(null);
  if (plan) lastRef.current = plan;
  const shown = plan ?? lastRef.current;

  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [supervision, setSupervision] = useState<Supervision>('confirm-each');
  useEffect(() => {
    if (plan) {
      setSkipped(new Set());
      setSupervision('confirm-each');
    }
  }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    onRun({ ...shown, steps: kept }, supervision);
  }

  return (
    <Sheet open={plan !== null} onDismiss={onCancel} maxHeightClass="max-h-[85%]">
      <p className="type-caption text-accent">Assistant · Plan</p>
      <h2 className="type-title mt-1">{shown.goal}</h2>
      <p className="type-body-sm mt-0.5 text-muted">
        {kept.length} step{kept.length === 1 ? '' : 's'}
        {appCount > 1 ? ` across ${appCount} apps` : ''}
        {skipped.size > 0 ? ` · ${skipped.size} skipped` : ''}
        <span className="text-muted/70"> — tap a step to skip it</span>
      </p>

      <ol className="mt-space-md flex flex-col gap-space-sm">
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

      <p className="type-caption mb-space-sm mt-space-lg text-muted">
        Supervision
      </p>
      <div className="flex gap-space-sm">
        {LEVELS.map((level) => {
          const on = supervision === level.id;
          return (
            <button
              key={level.id}
              onClick={() => setSupervision(level.id)}
              className={`flex-1 rounded-card p-space-sm text-center ring-1 transition duration-150 active:scale-[0.98] ${
                on
                  ? 'bg-accent/10 ring-accent/50'
                  : 'bg-bg/60 ring-text/5'
              }`}
            >
              <span
                className={`type-label block ${on ? 'text-accent' : 'text-text'}`}
              >
                {level.label}
              </span>
              <span className="type-caption mt-0.5 block text-muted">
                {level.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-space-xl flex gap-space-md">
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
    </Sheet>
  );
}
