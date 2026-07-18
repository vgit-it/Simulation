import { getApp } from '../world';
import type { ActivePlan } from './usePlanRunner';

interface PlanProgressProps {
  active: ActivePlan;
  /** True while the HUD plays its exit (completion beat + fade). */
  closing?: boolean;
  onCancel: () => void;
}

/**
 * The live execution HUD: a slim card pinned near the top of the phone while a
 * plan runs, showing the checklist with completed steps ticked and the current
 * step highlighted. The phone below visibly does the work (opens Photos, shows
 * the share proposal, hops to Messages); this just narrates where we are.
 *
 * Microanimated states: a progress bar fills per step, the current step wears
 * a spinner, finished checkmarks pop in, and a finished plan holds a
 * "✓ Plan complete" beat before the whole card fades out (`closing`).
 */
export function PlanProgress({ active, closing, onCancel }: PlanProgressProps) {
  const { plan, stepIndex } = active;
  const total = plan.steps.length;
  const doneCount = Math.min(stepIndex, total);
  const complete = stepIndex >= total;

  return (
    <div
      className={`pointer-events-auto absolute inset-x-3 top-14 z-20 rounded-card bg-surface/95 p-space-md shadow-sheet ring-1 ring-text/10 backdrop-blur ${
        closing ? 'animate-hud-out' : 'animate-rise'
      }`}
    >
      <div className="flex items-center justify-between">
        {complete ? (
          <p className="type-caption animate-pop text-accent">
            ✓ Plan complete
          </p>
        ) : (
          <p className="type-caption text-accent">
            <span className="inline-block animate-breathe">✨</span> Running
            plan · step {Math.min(stepIndex + 1, total)} of {total}
          </p>
        )}
        {!complete && (
          <button
            onClick={onCancel}
            className="type-label rounded-ds-full bg-text/10 px-space-md py-0.5 text-muted transition duration-150 active:scale-95"
          >
            Stop
          </button>
        )}
      </div>
      <p className="type-body-sm mt-0.5 font-medium">{plan.goal}</p>

      <div className="mt-space-sm h-1 overflow-hidden rounded-full bg-text/10">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500 ease-out-soft"
          style={{ width: `${(doneCount / total) * 100}%` }}
        />
      </div>

      <ul className="mt-space-sm flex flex-col gap-1">
        {plan.steps.map((step, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          const app = getApp(step.app);
          return (
            <li
              key={step.id}
              className={`flex animate-rise items-center gap-space-sm rounded-ds-sm px-1.5 py-1 transition-colors duration-200 ${
                current ? 'bg-accent/10' : ''
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {current ? (
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
              ) : (
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    done ? 'bg-accent text-white' : 'ring-1 ring-text/20'
                  }`}
                >
                  {done && <span className="animate-pop">✓</span>}
                </span>
              )}
              <span className="text-sm">{app.icon}</span>
              <span
                className={`type-caption min-w-0 truncate ${
                  current ? 'text-text' : done ? 'text-muted' : 'text-muted/60'
                }`}
              >
                {step.description}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
