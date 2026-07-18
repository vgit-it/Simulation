import { SIM_START } from '../config';
import type { SimEvent } from './events';

/** Derived record of a sent message. */
export interface Message {
  id: string;
  at: number;
  from: string;
  to: string[];
  body: string;
  attachments: string[];
  intent?: string;
}

/** A fact the brain tracked about a person. */
export interface Fact {
  at: number;
  key: string;
  value: string;
}

/** Derived record of one assistant-chat turn. */
export interface ChatTurnRecord {
  at: number;
  person: string;
  role: 'user' | 'assistant';
  text: string;
}

/** Derived record of a reminder. */
export interface Reminder {
  id: string;
  at: number;
  person: string;
  title: string;
  related: string[];
}

/** Derived record of a runtime plan through its whole lifecycle. */
export interface PlanRun {
  planId: string;
  person: string;
  goal: string;
  steps: number;
  at: number;
  /**
   * Lifecycle: 'proposed' (previewed, not yet approved) -> 'running' ->
   * 'completed' | 'cancelled' (aborted mid-run) | 'declined' (never started).
   */
  outcome: 'proposed' | 'running' | 'completed' | 'cancelled' | 'declined';
  /** Supervision level the run was started with (absent on old logs). */
  supervision?: string;
  /** Steps the user struck from the proposal before running (plan editing). */
  struck?: number;
  /** How many steps have finished so far (per-step telemetry). */
  stepsDone: number;
}

/** Runtime (mutable) world state, all derived from the event log. */
export interface RuntimeState {
  clock: number; // sim epoch ms
  log: SimEvent[]; // append-only source of truth (persisted)
  messages: Message[];
  facts: Record<string, Fact[]>; // personId -> facts
  reminders: Reminder[]; // in creation order
  plans: PlanRun[]; // runtime plans, in start order
  chats: ChatTurnRecord[]; // assistant-chat turns, in order
  reads: Record<string, Record<string, number>>; // personId -> threadKey -> last read at
}

export function freshState(): RuntimeState {
  return {
    clock: SIM_START.getTime(),
    log: [],
    messages: [],
    facts: {},
    reminders: [],
    plans: [],
    chats: [],
    reads: {},
  };
}

/**
 * Fold one event into derived state. Pure and log-agnostic (does NOT touch
 * `log`), so it can be reused to replay a persisted log via `hydrate`.
 */
function apply(state: RuntimeState, event: SimEvent): RuntimeState {
  switch (event.type) {
    case 'MessageSent':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: event.id,
            at: event.at,
            from: event.from,
            to: event.to,
            body: event.body,
            attachments: event.attachments,
            intent: event.intent,
          },
        ],
      };
    case 'FactRecorded': {
      const list = state.facts[event.person] ?? [];
      return {
        ...state,
        facts: {
          ...state.facts,
          [event.person]: [
            ...list,
            { at: event.at, key: event.key, value: event.value },
          ],
        },
      };
    }
    case 'ClockSet':
      return { ...state, clock: event.to };
    case 'ThreadRead': {
      const mine = state.reads[event.person] ?? {};
      return {
        ...state,
        reads: {
          ...state.reads,
          [event.person]: {
            ...mine,
            [event.thread]: Math.max(mine[event.thread] ?? -1, event.at),
          },
        },
      };
    }
    case 'ChatMessage':
      return {
        ...state,
        chats: [
          ...state.chats,
          {
            at: event.at,
            person: event.person,
            role: event.role,
            text: event.text,
          },
        ],
      };
    case 'ReminderCreated':
      return {
        ...state,
        reminders: [
          ...state.reminders,
          {
            id: event.id,
            at: event.at,
            person: event.person,
            title: event.title,
            related: event.related,
          },
        ],
      };
    case 'PlanProposed':
      return {
        ...state,
        plans: [
          ...state.plans,
          {
            planId: event.planId,
            person: event.person,
            goal: event.goal,
            steps: event.steps,
            at: event.at,
            outcome: 'proposed',
            stepsDone: 0,
          },
        ],
      };
    case 'PlanStarted': {
      // Usually updates the 'proposed' entry in place; creates one for logs
      // predating PlanProposed (or plans started without a preview).
      const existing = state.plans.find((p) => p.planId === event.planId);
      const started: PlanRun = {
        planId: event.planId,
        person: event.person,
        goal: event.goal,
        steps: event.steps, // the run's (possibly trimmed) step count
        at: existing?.at ?? event.at,
        outcome: 'running',
        supervision: event.supervision,
        struck: event.struck,
        stepsDone: 0,
      };
      return {
        ...state,
        plans: existing
          ? state.plans.map((p) => (p.planId === event.planId ? started : p))
          : [...state.plans, started],
      };
    }
    case 'PlanStepCompleted':
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.planId === event.planId ? { ...p, stepsDone: p.stepsDone + 1 } : p,
        ),
      };
    case 'PlanCompleted':
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.planId === event.planId ? { ...p, outcome: event.outcome } : p,
        ),
      };
    case 'AppOpened':
      return state; // no derived change yet
  }
}

export type StoreAction = { kind: 'event'; event: SimEvent } | { kind: 'reset' };

/** Store reducer: appends the event to the log and folds it into derived state. */
export function reduce(state: RuntimeState, action: StoreAction): RuntimeState {
  if (action.kind === 'reset') return freshState();
  return { ...apply(state, action.event), log: [...state.log, action.event] };
}

/** Rebuild full state from a persisted log (replay). */
export function hydrate(log: SimEvent[]): RuntimeState {
  const derived = log.reduce(apply, freshState());
  return { ...derived, log };
}
