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
      className="flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-bg to-surface px-6 py-16 text-center outline-none"
      aria-label="Unlock phone"
    >
      <div className="mt-10 flex flex-col items-center">
        <p className="text-sm text-muted">{longDate(now)}</p>
        <p className="mt-1 text-7xl font-semibold tracking-tight tabular-nums">
          {bigTime(now)}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-4xl">{owner.avatar}</span>
        <span className="text-sm text-muted">{owner.name}</span>
      </div>

      <div className="mb-2 flex flex-col items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-muted">
          Tap to unlock
        </span>
        <span className="h-1 w-28 rounded-full bg-text/40" />
      </div>
    </button>
  );
}
