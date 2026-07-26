import type { Notification } from '../state';
import type { DragHandlers } from '../ui';
import { NotificationCard } from './NotificationCard';

interface NotificationShadeProps {
  ownerId: string;
  notifications: Notification[];
  /** True while the shade is retracting (drives the exit animation). */
  closing: boolean;
  /**
   * 0 (fully closed) .. 1 (fully open) while a drag is live — overrides the
   * enter/exit animation with the panel following the finger. Undefined when
   * nothing is being dragged, so the normal CSS animation takes over.
   */
  dragProgress?: number;
  /** Drag the grabber up to close, following the finger. */
  dragHandlers?: DragHandlers;
  /** Open an app from a tapped notification (also closes the shade). */
  onOpen: (appId: string) => void;
  /** Swipe one notification away. */
  onDismiss: (id: string) => void;
  /** Dismiss everything currently showing (Clear all). */
  onClear: () => void;
  /** Tap the scrim / done — retract without clearing. */
  onClose: () => void;
}

/**
 * The pull-down notification shade: drops from the top edge over home/app
 * screens when the status bar is tapped (unlocked only — the lock screen has
 * its own notification stack). A scrim dims what's behind; the panel lists the
 * live notifications with a "Clear all". Rendered inside the Phone content
 * layer so it sits below the lock layer for free.
 */
export function NotificationShade({
  ownerId,
  notifications,
  closing,
  dragProgress,
  dragHandlers,
  onOpen,
  onDismiss,
  onClear,
  onClose,
}: NotificationShadeProps) {
  // While a drag is live, an inline transform overrides the CSS animation
  // classes (which would otherwise fight it every frame); once the drag ends,
  // the normal enter/exit animation takes back over from wherever it lands.
  const dragging = dragProgress !== undefined;
  return (
    <div className="absolute inset-0 z-20">
      <button
        aria-label="Close notifications"
        onClick={onClose}
        className={`absolute inset-0 cursor-default bg-black/30 ${
          closing ? 'animate-fade-out' : 'animate-fade-in'
        }`}
      />
      <div
        style={dragging ? { transform: `translateY(${(dragProgress - 1) * 100}%)` } : undefined}
        className={`absolute inset-x-0 top-0 flex max-h-[85%] flex-col rounded-b-screen bg-bg/95 px-space-lg pb-space-xl pt-space-lg shadow-sheet backdrop-blur-md ${
          dragging ? '' : closing ? 'animate-shade-out' : 'animate-shade-in'
        }`}
      >
        <div className="mb-space-md flex items-center justify-between">
          <h2 className="type-title">Notifications</h2>
          {notifications.length > 0 && (
            <button
              onClick={onClear}
              className="type-label rounded-ds-full bg-text/10 px-space-md py-1.5 text-text/80 transition duration-150 active:scale-95"
            >
              Clear all
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="type-body-sm py-space-2xl text-center text-muted">
            No notifications
          </p>
        ) : (
          <div className="flex min-h-0 flex-col gap-space-sm overflow-y-auto overscroll-y-contain">
            {notifications.map((n, i) => (
              <NotificationCard
                key={n.id}
                ownerId={ownerId}
                notification={n}
                onOpen={() => onOpen(n.appId)}
                onDismiss={() => onDismiss(n.id)}
                className="animate-rise"
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
              />
            ))}
          </div>
        )}

        {/* A grabber, One UI style — drag it up to close, following the finger. */}
        <span
          aria-hidden
          {...dragHandlers}
          className="mx-auto mt-space-md h-6 w-16 shrink-0 touch-none"
        >
          <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-text/25" />
        </span>
      </div>
    </div>
  );
}
