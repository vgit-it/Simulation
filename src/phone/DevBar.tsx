import { activeProviderName, switchProvider } from '../intelligence';
import { useHeroDevices, useSession } from '../session';
import { buildSessionExport, useNow, useStore } from '../state';
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
  const { state, dispatch, reset } = useStore();
  const people = Object.values(world.people);

  function advanceClock(hours: number) {
    dispatch({
      type: 'ClockSet',
      at: state.clock,
      to: state.clock + hours * 3_600_000,
    });
  }

  // Embodying a different person is "picking up their phone": start from the
  // lock screen so the POV switch reads clearly.
  function switchPerson(personId: string) {
    setPerson(personId);
    onScreenChange({ kind: 'locked' });
  }

  // Download the study session: the event log + its wall-clock/tap trace.
  function exportSession() {
    const data = buildSessionExport(state, activeProviderName());
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sim-session-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-xs text-white/60 backdrop-blur">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="mr-1 text-white/40">POV</span>
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => switchPerson(p.id)}
            title={p.name}
            className={`rounded-full px-2.5 py-1 transition-colors duration-150 ${
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
        <button
          onClick={() => advanceClock(1)}
          className="rounded-full bg-white/5 px-3 py-1 transition-colors duration-150 hover:bg-white/10"
          title="Advance the sim clock one hour (resident autopilot may act)"
        >
          +1h
        </button>

        {devices.length > 1 &&
          devices.map((d) => (
            <button
              key={d.id}
              onClick={() => setDevice(d.id)}
              className={`rounded-full px-3 py-1 transition-colors duration-150 ${
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
          className="rounded-full bg-white/5 px-3 py-1 transition-colors duration-150 hover:bg-white/10"
          title="Clear all runtime state (sent messages, tracked facts)"
        >
          ↺ Reset world
        </button>

        <button
          onClick={exportSession}
          className="rounded-full bg-white/5 px-3 py-1 transition-colors duration-150 hover:bg-white/10"
          title="Download this session as JSON: the event log plus its wall-clock/tap trace, for analysis"
        >
          ⬇ Export
        </button>

        <button
          onClick={() =>
            switchProvider(
              activeProviderName() === 'mock' ? 'llm-dry-run' : 'mock',
            )
          }
          className="rounded-full bg-white/5 px-3 py-1 transition-colors duration-150 hover:bg-white/10"
          title="Switch the assistant brain. 'llm dry-run' shows the exact API request the real model would receive — no call is made."
        >
          {activeProviderName() === 'mock' ? '🧪 mock brain' : '🔌 llm dry-run'}
        </button>
      </div>
    </div>
  );
}
