/**
 * Single place for simulation-wide configuration. Kept tiny and explicit so the
 * simulation stays deterministic and easy to reason about.
 */

/**
 * The simulation's initial clock. Runtime "now" lives in the state store
 * (src/state) and starts here; scenarios/events can advance it. Everything
 * time-related reads the store's clock (useNow / selectNow), NOT the wall clock,
 * so the world behaves identically whenever it runs.
 */
export const SIM_START = new Date('2026-07-16T12:00:00');

/** The "hero": whose device the viewer embodies when the app boots. */
export const HERO_PERSON_ID = 'ava-chen';
export const HERO_DEVICE_ID = 'ava-phone';

/**
 * Which intelligence provider backs derived/"smart" results. 'mock' is fully
 * deterministic and spends no tokens; an 'llm' provider can drop in later behind
 * the same interface without touching the UI.
 */
export const INTELLIGENCE_PROVIDER: 'mock' = 'mock';
