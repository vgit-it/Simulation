import { useHeroDevices, useSession } from '../session';
import { useNow, useStore } from '../state';

function timeLabel(d: Date): string {
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Out-of-phone developer controls: shows the sim clock, switches between the
 * hero's devices, and resets runtime state (clears the persisted event log).
 */
export function DevBar() {
  const { session, setDevice } = useSession();
  const devices = useHeroDevices();
  const now = useNow();
  const { reset } = useStore();

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-white/60">
      <span className="rounded-full bg-white/5 px-3 py-1">🕒 {timeLabel(now)}</span>

      {devices.length > 1 &&
        devices.map((d) => (
          <button
            key={d.id}
            onClick={() => setDevice(d.id)}
            className={`rounded-full px-3 py-1 ${
              d.id === session.deviceId
                ? 'bg-white/20 text-white'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            {d.name}
          </button>
        ))}

      <button
        onClick={reset}
        className="rounded-full bg-white/5 px-3 py-1 hover:bg-white/10"
        title="Clear all runtime state (sent messages, tracked facts)"
      >
        ↺ Reset world
      </button>
    </div>
  );
}
