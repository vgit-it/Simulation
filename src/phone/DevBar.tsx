import { useHeroDevices, useSession } from '../session';
import { useNow, useStore } from '../state';
import { world } from '../world';
import type { Screen } from './Phone';

function timeLabel(d: Date): string {
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface DevBarProps {
  onScreenChange: (screen: Screen) => void;
}

/**
 * Out-of-phone developer controls: shows the sim clock, switches which person
 * (POV) and which of their devices is embodied, and resets runtime state
 * (clears the persisted event log).
 */
export function DevBar({ onScreenChange }: DevBarProps) {
  const { session, setDevice, setPerson } = useSession();
  const devices = useHeroDevices();
  const now = useNow();
  const { reset } = useStore();
  const people = Object.values(world.people);

  // Embodying a different person is "picking up their phone": start from the
  // lock screen so the POV switch reads clearly.
  function switchPerson(personId: string) {
    setPerson(personId);
    onScreenChange({ kind: 'locked' });
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2 text-xs text-white/60">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="mr-1 text-white/40">POV</span>
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => switchPerson(p.id)}
            title={p.name}
            className={`rounded-full px-2.5 py-1 ${
              p.id === session.personId
                ? 'bg-white/20 text-white'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            {p.avatar} {p.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
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
    </div>
  );
}
