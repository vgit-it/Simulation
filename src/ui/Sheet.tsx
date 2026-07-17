import type { ReactNode } from 'react';
import { EXIT } from './motion';
import { OverlayLayer } from './OverlayLayer';
import { useMountTransition } from './useMountTransition';

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
          className={`relative overflow-y-auto rounded-t-ds-lg bg-surface p-space-xl pb-space-2xl shadow-sheet ${maxHeightClass} ${
            closing ? 'animate-slide-down' : 'animate-slide-up'
          }`}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-text/30" />
          {children}
        </div>
      </div>
    </OverlayLayer>
  );
}
