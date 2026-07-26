import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

const DEFAULT_DELAY_MS = 450;

export interface LongPressHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
  onContextMenu: (e: ReactMouseEvent) => void;
}

export interface LongPressState {
  handlers: LongPressHandlers;
  /**
   * True if the press just held long enough to fire `onLongPress` — check
   * this from an `onClick` on the same element to suppress its normal tap
   * action (a long press that entered select mode shouldn't also open the
   * photo it started on).
   */
  wasLongPress: () => boolean;
}

/**
 * Press-and-hold gesture: NavBar's home button (hold → invoke the assistant)
 * and Photos' tile (hold → enter multi-select) share this one implementation.
 */
export function useLongPress(
  onLongPress: () => void,
  delayMs: number = DEFAULT_DELAY_MS,
): LongPressState {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const held = useRef(false);
  const callback = useRef(onLongPress);
  callback.current = onLongPress;

  useEffect(() => () => clearTimeout(timer.current), []);

  function onPointerDown() {
    held.current = false;
    timer.current = setTimeout(() => {
      held.current = true;
      callback.current();
    }, delayMs);
  }

  function cancel() {
    clearTimeout(timer.current);
  }

  return {
    handlers: {
      onPointerDown,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e) => e.preventDefault(),
    },
    wasLongPress: () => held.current,
  };
}
