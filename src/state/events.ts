/**
 * The event log is the source of truth for everything mutable in the world.
 * Authored content (world/) is the read-only seed; every interaction — a message
 * sent, a fact the brain tracked, the clock advancing — is an append-only event.
 * Derived state (messages, facts, ...) is a fold over this log, so persistence is
 * just "save the log" and time-travel/replay comes for free.
 */

/** A message (or share) sent from one person to others. */
export interface MessageSentEvent {
  type: 'MessageSent';
  id: string;
  at: number; // simulation epoch ms
  from: string;
  to: string[];
  body: string;
  attachments: string[]; // asset/photo ids
  intent?: string; // e.g. 'share-photos'
}

/** Something the per-person brain learned/tracked. */
export interface FactRecordedEvent {
  type: 'FactRecorded';
  at: number;
  person: string;
  key: string;
  value: string;
}

/** An app was opened (light activity signal). */
export interface AppOpenedEvent {
  type: 'AppOpened';
  at: number;
  person: string;
  appId: string;
}

/** Move the simulation clock (used by scenarios/manual controls). */
export interface ClockSetEvent {
  type: 'ClockSet';
  at: number;
  to: number; // new sim epoch ms
}

/** The assistant began executing a runtime plan for a person. */
export interface PlanStartedEvent {
  type: 'PlanStarted';
  at: number;
  person: string;
  planId: string;
  goal: string;
  steps: number;
}

/** A runtime plan finished executing (all steps done, or cancelled). */
export interface PlanCompletedEvent {
  type: 'PlanCompleted';
  at: number;
  person: string;
  planId: string;
  outcome: 'completed' | 'cancelled';
}

export type SimEvent =
  | MessageSentEvent
  | FactRecordedEvent
  | AppOpenedEvent
  | ClockSetEvent
  | PlanStartedEvent
  | PlanCompletedEvent;

let counter = 0;
/** Deterministic-ish unique id for events/proposals (stable within a session). */
export function uid(prefix = 'e'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}
