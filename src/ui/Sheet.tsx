import type { ReactNode } from 'react';
import { useBackHandler } from './back';
import { LAYER } from './backStack';
import { EXIT } from './motion';
import { OverlayLayer } from './OverlayLayer';
import { useDrag } from './useDrag';
import { useMountTransition } from './useMountTransition';

/** Px of downward drag on the grabber that counts as "fully dragged". */
const DISMISS_DRAG_EXTENT = 100;

interface SheetProps {
  open: boolean;
  onDismiss: () => void;
  /** aria-label for the dismiss scrim. */
  dismissLabel?: string;
  /** e.g. 'max-h-[85%]' to cap a tall, scrollable sheet. */
  maxHeightClass?: string;
  children: ReactNode;
}

/**
 * The OS bottom sheet: fading scrim + sliding panel + grabber. Handles its own
 * mount/unmount so callers just toggle `open`; the exit animation plays before
 * the sheet leaves the tree.
 */
export function Sheet({
  open,
  onDismiss,
  dismissLabel = 'Dismiss',
  maxHeightClass = '',
  children,
}: SheetProps) {
  const { mounted, closing } = useMountTransition(open, EXIT.sheet);
  useBackHandler(open, onDismiss, LAYER.overlay);
  // The grabber's own drag: down commits to dismiss, following the finger
  // live; releasing short of the threshold springs the panel back.
  const drag = useDrag({
    axis: 'y',
    direction: 1,
    extent: DISMISS_DRAG_EXTENT,
    onCommit: onDismiss,
  });
  if (!mounted) return null;

  return (
    <OverlayLayer>
      <div className="absolute inset-0 z-30 flex flex-col justify-end">
        <button
          aria-label={dismissLabel}
          onClick={onDismiss}
          className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] ${
            closing ? 'animate-fade-out' : 'animate-fade-in'
          }`}
        />
        <div
          style={drag.dragging ? { transform: `translateY(${drag.offset}px)` } : undefined}
          className={`relative overflow-y-auto overscroll-y-contain rounded-t-ds-lg bg-surface p-space-xl pb-space-2xl shadow-sheet ${maxHeightClass} ${
            drag.dragging ? '' : closing ? 'animate-slide-down' : 'animate-slide-up'
          }`}
        >
          <span {...drag.handlers} aria-hidden className="mx-auto -mt-2 mb-2 block h-6 w-16 touch-none">
            <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-text/30" />
          </span>
          {children}
        </div>
      </div>
    </OverlayLayer>
  );
}
