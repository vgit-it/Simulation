import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './motion';

/**
 * Presence helper for exit animations on conditionally rendered elements:
 * keeps the element mounted for `exitMs` after `open` flips false so a CSS
 * exit animation can play, then unmounts it.
 *
 * Purely presentational — the timeout paces a CSS animation and never touches
 * sim state, so determinism (principle 5) is unaffected.
 */
export function useMountTransition(
  open: boolean,
  exitMs: number,
): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      clearTimeout(timer.current);
      setMounted(true);
      return;
    }
    if (!mounted) return;
    timer.current = setTimeout(
      () => setMounted(false),
      prefersReducedMotion() ? 0 : exitMs,
    );
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exitMs]);

  return { mounted, closing: mounted && !open };
}
