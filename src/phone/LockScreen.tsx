import { useNow } from '../state';
import type { LoadedPerson } from '../world';

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
}

/**
 * One UI-style lock screen: big bold clock with the date beneath, a Now
 * Bar-style pill carrying the owner identity, and the two frosted corner
 * shortcuts (decorative — the whole screen is the unlock control).
 */
export function LockScreen({ owner, onUnlock }: LockScreenProps) {
  const now = useNow();
  return (
    <button
      onClick={onUnlock}
      className="flex h-full w-full flex-col items-center bg-bg bg-gradient-to-b from-accent/25 via-bg to-bg px-6 pb-6 pt-24 text-center outline-none transition-transform duration-150 active:scale-[0.99]"
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
