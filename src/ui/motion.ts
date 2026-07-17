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
} as const;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
