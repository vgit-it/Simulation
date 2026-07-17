import { getApp } from '../world';
import type { ActivePlan } from './usePlanRunner';

interface PlanProgressProps {
  active: ActivePlan;
  onCancel: () => void;
}

/**
 * The live execution HUD: a slim card pinned near the top of the phone while a
 * plan runs, showing the checklist with completed steps ticked and the current
 * step highlighted. The phone below visibly does the work (opens Photos, shows
 * the share proposal, hops to Messages); this just narrates where we are.
 */
export function PlanProgress({ active, onCancel }: PlanProgressProps) {
  const { plan, stepIndex } = active;

  return (
    <div className="pointer-events-auto absolute inset-x-3 top-14 z-20 animate-rise rounded-card bg-surface/95 p-space-md shadow-sheet ring-1 ring-text/10 backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="type-caption text-accent">✨ Running plan</p>
        <button
          onClick={onCancel}
          className="type-label rounded-ds-full bg-text/10 px-space-md py-0.5 text-muted transition duration-150 active:scale-95"
        >
          Stop
        </button>
      </div>
      <p className="type-body-sm mt-0.5 font-medium">{plan.goal}</p>

      <ul className="mt-space-sm flex flex-col gap-1">
        {plan.steps.map((step, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          const app = getApp(step.app);
          return (
            <li
              key={step.id}
              className={`flex items-center gap-space-sm rounded-ds-sm px-1.5 py-1 transition-colors duration-200 ${
                current ? 'bg-accent/10' : ''
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  done
                    ? 'bg-accent text-white'
                    : current
                      ? 'ring-2 ring-accent'
                      : 'ring-1 ring-text/20'
                }`}
              >
                {done ? '✓' : ''}
              </span>
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
