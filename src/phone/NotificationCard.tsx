import type { CSSProperties } from 'react';
import type { Notification } from '../state';
import { useDrag } from '../ui';
import { resolvePerson } from '../world';

/** Px of horizontal drag that counts as "fully swiped away". */
const DISMISS_DRAG_EXTENT = 120;

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
  /** Swiped away (horizontal drag past the threshold, or a flick). */
  onDismiss?: () => void;
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
  onDismiss,
  className,
  style,
}: NotificationCardProps) {
  const sender = n.fromId ? resolvePerson(ownerId, n.fromId) : null;
  const icon = sender?.avatar ?? (n.kind === 'reminder' ? '⏰' : '🔔');
  const title = sender?.name ?? n.title;

  // Either direction dismisses, like a real swipe-away card: both drags track
  // the same pointer, and only the one matching the actual swipe direction
  // ever has a nonzero offset or commits.
  const right = useDrag({
    axis: 'x',
    direction: 1,
    extent: DISMISS_DRAG_EXTENT,
    onCommit: () => onDismiss?.(),
    disabled: !onDismiss,
  });
  const left = useDrag({
    axis: 'x',
    direction: -1,
    extent: DISMISS_DRAG_EXTENT,
    onCommit: () => onDismiss?.(),
    disabled: !onDismiss,
  });
  const swiping = right.dragging || left.dragging;
  const swipeOffset = right.offset || left.offset;

  return (
    <button
      onClick={onOpen}
      onPointerDown={(e) => {
        right.handlers.onPointerDown(e);
        left.handlers.onPointerDown(e);
      }}
      onPointerMove={(e) => {
        right.handlers.onPointerMove(e);
        left.handlers.onPointerMove(e);
      }}
      onPointerUp={(e) => {
        right.handlers.onPointerUp(e);
        left.handlers.onPointerUp(e);
      }}
      onPointerCancel={(e) => {
        right.handlers.onPointerCancel(e);
        left.handlers.onPointerCancel(e);
      }}
      style={{
        ...style,
        transform: swipeOffset ? `translateX(${swipeOffset}px)` : style?.transform,
        opacity: swipeOffset ? Math.max(0.2, 1 - Math.abs(swipeOffset) / DISMISS_DRAG_EXTENT) : undefined,
      }}
      className={`flex w-full touch-pan-y items-start gap-space-md rounded-card bg-surface/90 p-space-md text-left ring-1 ring-text/5 backdrop-blur-sm active:scale-[0.98] ${
        swiping ? '' : 'transition duration-150'
      } ${className ?? ''}`}
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
