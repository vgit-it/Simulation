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

/** Derived record of a runtime plan the assistant ran. */
export interface PlanRun {
  planId: string;
  person: string;
  goal: string;
  steps: number;
  at: number;
  outcome: 'running' | 'completed' | 'cancelled';
  /** Supervision level the run was started with (absent on old logs). */
  supervision?: string;
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
    case 'PlanStarted':
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
            outcome: 'running',
            supervision: event.supervision,
          },
        ],
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
