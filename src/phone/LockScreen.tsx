import { useNow } from '../state';
import type { LoadedPerson } from '../world';

function bigTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function longDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

interface LockScreenProps {
  owner: LoadedPerson;
  onUnlock: () => void;
}

export function LockScreen({ owner, onUnlock }: LockScreenProps) {
  const now = useNow();
  return (
    <button
      onClick={onUnlock}
      className="flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-bg to-surface px-6 py-16 text-center outline-none transition-transform duration-150 active:scale-[0.99]"
      aria-label="Unlock phone"
    >
      <div className="mt-10 flex flex-col items-center">
        <p
          className="type-label animate-fade-in text-muted"
          style={{ animationDelay: '100ms' }}
        >
          {longDate(now)}
        </p>
        <p className="type-display animate-rise mt-1 tabular-nums">
          {bigTime(now)}
        </p>
      </div>

      <div
        className="flex animate-rise flex-col items-center gap-space-sm"
        style={{ animationDelay: '150ms' }}
      >
        <span className="text-4xl">{owner.avatar}</span>
        <span className="type-body-sm text-muted">{owner.name}</span>
      </div>

      <div className="mb-2 flex flex-col items-center gap-space-md">
        <span className="type-caption text-muted motion-safe:animate-breathe">
          Tap to unlock
        </span>
        <span className="h-1 w-28 rounded-full bg-text/40" />
      </div>
    </button>
  );
}
