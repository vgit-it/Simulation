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
 * Which intelligence provider backs derived/"smart" results.
 *  - 'mock': fully deterministic, no tokens (the default — always works offline).
 *  - 'llm-dry-run': chat assembles the EXACT Anthropic API request (system
 *    prompt + capability tools + messages) and shows it instead of calling —
 *    no key, no network. The M5 real provider will reuse the same builder.
 * The Settings app's Brain toggle overrides this per-browser via localStorage.
 */
export type IntelligenceProviderName = 'mock' | 'llm-dry-run';
export const INTELLIGENCE_PROVIDER: IntelligenceProviderName = 'mock';
