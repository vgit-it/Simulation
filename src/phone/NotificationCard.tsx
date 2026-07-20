import type { CSSProperties } from 'react';
import type { Notification } from '../state';
import { resolvePerson } from '../world';

function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface NotificationCardProps {
  /** Whose phone we're on — resolves a message sender's avatar/name. */
  ownerId: string;
  notification: Notification;
  onOpen: () => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * One notification, shared by the lock screen and the pull-down shade. A
 * message notification wears its sender's avatar + name (resolved here, keeping
 * the selector `world`-free); a reminder shows a clock + its "Reminder" title.
 * Tapping opens the owning app.
 */
export function NotificationCard({
  ownerId,
  notification: n,
  onOpen,
  className,
  style,
}: NotificationCardProps) {
  const sender = n.fromId ? resolvePerson(ownerId, n.fromId) : null;
  const icon = sender?.avatar ?? (n.kind === 'reminder' ? '⏰' : '🔔');
  const title = sender?.name ?? n.title;
  return (
    <button
      onClick={onOpen}
      style={style}
      className={`flex w-full items-start gap-space-md rounded-card bg-surface/90 p-space-md text-left ring-1 ring-text/5 backdrop-blur-sm transition duration-150 active:scale-[0.98] ${
        className ?? ''
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-space-sm">
          <span className="type-body-sm truncate font-semibold text-text">
            {title}
          </span>
          <span className="type-caption shrink-0 text-muted">
            {timeLabel(n.at)}
          </span>
        </span>
        <span className="type-body-sm mt-0.5 line-clamp-2 text-muted">
          {n.body}
        </span>
        {n.attachments > 0 && (
          <span className="type-caption mt-0.5 block text-accent">
            📎 {n.attachments} photo{n.attachments === 1 ? '' : 's'}
          </span>
        )}
      </span>
    </button>
  );
}
