/**
 * Single place for simulation-wide configuration. Kept tiny and explicit so the
 * simulation stays deterministic and easy to reason about.
 */

/**
 * The simulation's "current time". Photos and time-grouping are measured
 * against this, NOT the real wall clock, so the world behaves identically no
 * matter when it is run. Later this can move into world content.
 */
export const SIM_NOW = new Date('2026-07-16T12:00:00');

/** Which person's device boots when the app loads (the "prototype" device). */
export const BOOT_PERSON_ID = 'ava-chen';
export const BOOT_DEVICE_ID = 'ava-phone';

/**
 * Which intelligence provider backs derived/"smart" results. 'mock' is fully
 * deterministic and spends no tokens; an 'llm' provider can drop in later
 * behind the same interface without touching the UI.
 */
export const INTELLIGENCE_PROVIDER: 'mock' = 'mock';
