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

/** Runtime (mutable) world state, all derived from the event log. */
export interface RuntimeState {
  clock: number; // sim epoch ms
  log: SimEvent[]; // append-only source of truth (persisted)
  messages: Message[];
  facts: Record<string, Fact[]>; // personId -> facts
}

export function freshState(): RuntimeState {
  return { clock: SIM_START.getTime(), log: [], messages: [], facts: {} };
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
