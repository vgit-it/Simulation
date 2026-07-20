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

/** A person opened (read) a message thread. */
export interface ThreadReadEvent {
  type: 'ThreadRead';
  at: number;
  person: string;
  /** The thread key (its sorted participant set joined with '+'). */
  thread: string;
}

/**
 * A person cleared their notification shade ("Clear all"). Like ThreadRead,
 * it records a watermark — every notification at or before `at` is dismissed;
 * anything newer (a later message, a reminder created after) surfaces again.
 */
export interface NotificationsClearedEvent {
  type: 'NotificationsCleared';
  at: number;
  person: string;
}

/** One turn of a person's conversation with their assistant. */
export interface ChatMessageEvent {
  type: 'ChatMessage';
  at: number;
  person: string;
  role: 'user' | 'assistant';
  text: string;
  /**
   * The conversation thread this turn belongs to. A fresh id is minted every
   * time the assistant is invoked outside an existing thread (the FAB), so
   * each request is its own conversation; resuming a thread from the
   * Assistant app reuses its id. Absent on logs predating threads.
   */
  session?: string;
}

/** A reminder a person created (directly or via the assistant). */
export interface ReminderCreatedEvent {
  type: 'ReminderCreated';
  id: string;
  at: number;
  person: string;
  title: string;
  /** Asset/photo ids this reminder refers to (renderable context). */
  related: string[];
}

/**
 * The assistant proposed a runtime plan (the PlanSheet was shown). Recorded
 * BEFORE any approval so declined plans leave a telemetry trail too.
 */
export interface PlanProposedEvent {
  type: 'PlanProposed';
  at: number;
  person: string;
  planId: string;
  goal: string;
  steps: number;
}

/** The assistant began executing a runtime plan for a person. */
export interface PlanStartedEvent {
  type: 'PlanStarted';
  at: number;
  person: string;
  planId: string;
  goal: string;
  steps: number;
  /** The supervision level the user chose ('confirm-each' | 'confirm-once' | 'auto'). */
  supervision?: string;
  /** How many proposed steps the user struck out before running (plan editing). */
  struck?: number;
}

/** One step of a running plan finished (committed or auto-advanced). */
export interface PlanStepCompletedEvent {
  type: 'PlanStepCompleted';
  at: number;
  person: string;
  planId: string;
  stepIndex: number;
  /** The step's checklist description (readable telemetry). */
  label: string;
}

/**
 * A runtime plan reached a terminal state: every step done ('completed'),
 * aborted mid-run ('cancelled'), or dismissed at the preview sheet without
 * ever starting ('declined').
 */
export interface PlanCompletedEvent {
  type: 'PlanCompleted';
  at: number;
  person: string;
  planId: string;
  outcome: 'completed' | 'cancelled' | 'declined';
}

export type SimEvent =
  | MessageSentEvent
  | FactRecordedEvent
  | AppOpenedEvent
  | ClockSetEvent
  | ThreadReadEvent
  | NotificationsClearedEvent
  | ChatMessageEvent
  | ReminderCreatedEvent
  | PlanProposedEvent
  | PlanStartedEvent
  | PlanStepCompletedEvent
  | PlanCompletedEvent;

let counter = 0;
/** Deterministic-ish unique id for events/proposals (stable within a session). */
export function uid(prefix = 'e'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}
