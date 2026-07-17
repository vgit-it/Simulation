/**
 * A runtime plan: the assistant's decomposition of a free-form request into an
 * ordered sequence of steps over the capability registry, generated AFTER the
 * request arrives (unlike an authored scenario, which is fixed up front). A plan
 * is essentially a scenario the brain writes on the fly, and it executes through
 * the same levers — focus a person's phone on an app, dispatch events — so the
 * user can watch the work happen step by step across apps.
 */
export interface PlanStep {
  id: string;
  /** The app this step happens in — drives the visual (the phone opens it). */
  app: string;
  /** Human-readable line shown in the plan checklist. */
  description: string;
  /**
   * If present, this step ACTS: it builds a `Proposal` for this capability
   * (an intent id from the registry) over `ids` when reached, surfaced for the
   * user to approve. Absent = a navigate/gather step: the phone just opens the
   * app so the user sees the context the next step acts on.
   */
  intent?: string;
  /** The object ids an action/gather step operates on (e.g. photo ids). */
  ids?: string[];
}

export interface Plan {
  id: string;
  /** A restatement of what the user asked, shown as the plan's title. */
  goal: string;
  steps: PlanStep[];
}
