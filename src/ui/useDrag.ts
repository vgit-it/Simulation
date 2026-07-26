import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { resolveDrag } from './drag';
import { prefersReducedMotion } from './motion';

export interface UseDragOptions {
  /** Which axis the drag moves along. */
  axis: 'x' | 'y';
  /** +1 if positive (down/right) movement commits, -1 if negative (up/left) does. */
  direction: 1 | -1;
  /** Px distance in the commit direction that counts as "fully dragged". */
  extent: number;
  /** Fires once the drag commits (crossed the threshold, or a fast flick). */
  onCommit: () => void;
  /** Disables the gesture (e.g. it's not the active affordance right now). */
  disabled?: boolean;
}

export interface DragHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
}

export interface DragState {
  handlers: DragHandlers;
  /** Live px offset to translate the element by — natural sign, clamped to
   * the commit direction (no rubber-banding the other way). Always 0 under
   * `prefers-reduced-motion` so nothing visibly follows the pointer; the
   * commit/cancel decision on release is unaffected. */
  offset: number;
  dragging: boolean;
}

/**
 * Pointer-drag gesture: tracks a live offset while dragging so callers can
 * translate the element, and resolves commit/cancel via `resolveDrag` on
 * release. One implementation shared by swipe-to-unlock, the shade drag,
 * swipe-down-to-dismiss, and swipe-away notifications.
 */
export function useDrag({
  axis,
  direction,
  extent,
  onCommit,
  disabled,
}: UseDragOptions): DragState {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ pos: number; at: number } | null>(null);

  const reset = useCallback(() => {
    start.current = null;
    setOffset(0);
    setDragging(false);
  }, []);

  function pos(e: ReactPointerEvent): number {
    return axis === 'x' ? e.clientX : e.clientY;
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (disabled) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    start.current = { pos: pos(e), at: performance.now() };
    setDragging(true);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!start.current) return;
    const raw = pos(e) - start.current.pos;
    const inDirection = raw * direction >= 0;
    setOffset(inDirection && !prefersReducedMotion() ? raw : 0);
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (!start.current) return;
    const elapsed = performance.now() - start.current.at;
    const raw = pos(e) - start.current.pos;
    const inDirection = raw * direction >= 0;
    const magnitude = inDirection ? Math.abs(raw) : 0;
    const result = resolveDrag({ delta: magnitude, elapsed, extent });
    reset();
    if (result === 'commit') onCommit();
  }

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset },
    offset,
    dragging,
  };
}
