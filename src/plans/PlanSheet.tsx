import { useRef } from 'react';
import { Sheet } from '../ui';
import { getApp } from '../world';
import type { Plan } from './types';

interface PlanSheetProps {
  /** The plan to preview, or null when nothing is pending (sheet hidden). */
  plan: Plan | null;
  onRun: () => void;
  onCancel: () => void;
}

/**
 * The plan preview: shows the assistant's decomposition as a numbered,
 * app-tagged checklist BEFORE anything runs, so the user sees (and approves)
 * exactly what will happen across which apps. Approve → the runner walks the
 * phone through it. This is the plan sibling of ProposalSheet.
 */
export function PlanSheet({ plan, onRun, onCancel }: PlanSheetProps) {
  const lastRef = useRef<Plan | null>(null);
  if (plan) lastRef.current = plan;
  const shown = plan ?? lastRef.current;
  if (!shown) return null;

  const appCount = new Set(shown.steps.map((s) => s.app)).size;

  return (
    <Sheet open={plan !== null} onDismiss={onCancel} maxHeightClass="max-h-[85%]">
      <p className="type-caption text-accent">Assistant · Plan</p>
      <h2 className="type-title mt-1">{shown.goal}</h2>
      <p className="type-body-sm mt-0.5 text-muted">
        {shown.steps.length} step{shown.steps.length === 1 ? '' : 's'}
        {appCount > 1 ? ` across ${appCount} apps` : ''}
      </p>

      <ol className="mt-space-md flex flex-col gap-space-sm">
        {shown.steps.map((step, i) => {
          const app = getApp(step.app);
          return (
            <li
              key={step.id}
              className="flex animate-rise items-center gap-space-md rounded-card bg-bg/60 p-space-md ring-1 ring-text/5"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="type-label flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-text/10 text-muted">
                {i + 1}
              </span>
              <span className="text-xl">{app.icon}</span>
              <span className="min-w-0">
                <span className="type-body block">{step.description}</span>
                <span className="type-caption block text-muted">
                  {app.name}
                  {step.intent ? ' · action' : ''}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-space-xl flex gap-space-md">
        <button
          onClick={onCancel}
          className="type-label flex-1 rounded-ds-full bg-text/10 py-2.5 text-text transition duration-150 ease-out-soft active:scale-95"
        >
          Cancel
        </button>
        <button
          onClick={onRun}
          className="type-label flex-1 rounded-ds-full bg-accent py-2.5 text-white transition duration-150 ease-out-soft active:scale-95"
        >
          Run plan
        </button>
      </div>
    </Sheet>
  );
}
