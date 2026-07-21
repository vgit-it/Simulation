import { notificationsFor, useNow, useStore } from '../state';
import type { LoadedPerson } from '../world';
import { NotificationCard } from './NotificationCard';

function bigTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function longDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  });
}

interface LockScreenProps {
  owner: LoadedPerson;
  onUnlock: () => void;
  /** Tapping a lock-screen notification unlocks straight into its app. */
  onOpenApp: (appId: string) => void;
}

/**
 * One UI-style lock screen: big bold clock with the date beneath, a stack of
 * notification cards, a Now Bar-style pill carrying the owner identity, and the
 * two frosted corner shortcuts (decorative — the whole screen is the unlock
 * control). A notification card is a nested button: tapping it opens its app,
 * tapping anywhere else unlocks.
 */
export function LockScreen({ owner, onUnlock, onOpenApp }: LockScreenProps) {
  const now = useNow();
  const { state } = useStore();
  const notifications = notificationsFor(state, owner.id);
  return (
    <button
      onClick={onUnlock}
      className="flex h-full w-full flex-col items-center overflow-y-auto bg-bg bg-gradient-to-b from-accent/25 via-bg to-bg px-6 pb-6 pt-20 text-center outline-none transition-transform duration-150 active:scale-[0.99]"
      aria-label="Unlock phone"
    >
      <div className="flex flex-col items-center">
        <p className="type-display animate-rise tabular-nums">{bigTime(now)}</p>
        <p
          className="type-body-sm mt-space-sm animate-fade-in text-text/80"
          style={{ animationDelay: '100ms' }}
        >
          {longDate(now)}
        </p>
      </div>

      {notifications.length > 0 && (
        <div
          className="mt-space-xl flex w-full flex-col gap-space-sm"
          // The cards are interactive; a tap inside must not bubble to unlock.
          onClick={(e) => e.stopPropagation()}
        >
          {notifications.map((n, i) => (
            <NotificationCard
              key={n.id}
              ownerId={owner.id}
              notification={n}
              onOpen={() => onOpenApp(n.appId)}
              className="animate-rise"
              style={{ animationDelay: `${150 + Math.min(i, 8) * 40}ms` }}
            />
          ))}
        </div>
      )}

      {/* Now Bar-style identity pill */}
      <span
        className="mt-auto flex animate-rise items-center gap-space-sm rounded-ds-full bg-text/10 py-space-sm pl-space-sm pr-space-lg backdrop-blur-sm"
        style={{ animationDelay: '150ms' }}
      >
        <span className="text-xl leading-none">{owner.avatar}</span>
        <span className="type-body-sm text-text/90">{owner.name}</span>
      </span>

      <span className="type-caption mb-space-lg mt-space-md text-muted motion-safe:animate-breathe">
        Tap to unlock
      </span>

      {/* frosted corner shortcuts, One UI style (decorative) */}
      <div className="flex w-full items-end justify-between">
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-text/10 text-xl backdrop-blur-sm"
        >
          📞
        </span>
        <span className="mb-1 h-1 w-28 rounded-full bg-text/40" />
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-text/10 text-xl backdrop-blur-sm"
        >
          📷
        </span>
      </div>
    </button>
  );
}
