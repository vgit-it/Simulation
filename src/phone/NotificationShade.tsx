import type { Notification } from '../state';
import { NotificationCard } from './NotificationCard';

interface NotificationShadeProps {
  ownerId: string;
  notifications: Notification[];
  /** True while the shade is retracting (drives the exit animation). */
  closing: boolean;
  /** Open an app from a tapped notification (also closes the shade). */
  onOpen: (appId: string) => void;
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
  onOpen,
  onClear,
  onClose,
}: NotificationShadeProps) {
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
        className={`absolute inset-x-0 top-0 flex max-h-[85%] flex-col rounded-b-screen bg-bg/95 px-space-lg pb-space-xl pt-space-lg shadow-sheet backdrop-blur-md ${
          closing ? 'animate-shade-out' : 'animate-shade-in'
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
          <div className="flex min-h-0 flex-col gap-space-sm overflow-y-auto">
            {notifications.map((n, i) => (
              <NotificationCard
                key={n.id}
                ownerId={ownerId}
                notification={n}
                onOpen={() => onOpen(n.appId)}
                className="animate-rise"
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
              />
            ))}
          </div>
        )}

        {/* A grabber, One UI style — signals "this pulled down from the top". */}
        <span
          aria-hidden
          className="mx-auto mt-space-md h-1 w-10 shrink-0 rounded-full bg-text/25"
        />
      </div>
    </div>
  );
}
