/**
 * Shared motion constants for the OS. Motion is presentation only: these
 * durations pace CSS animations and never feed sim state (the sim clock in
 * src/state stays the only time source for content).
 */

/** Exit-animation durations (ms), mirroring the animation specs in tailwind.config.ts. */
export const EXIT = {
  sheet: 300,
  app: 250,
  lock: 350,
  fade: 200,
  /** Plan HUD: a 450ms readable hold (the completion beat) + 250ms fade. */
  hud: 700,
} as const;

/** How long the assistant's typing-dots beat runs before a reply reveals. */
export const THINKING_BEAT_MS = 700;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
