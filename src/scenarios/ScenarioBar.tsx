import { useEffect, useState } from 'react';
import type { Screen } from '../phone/Phone';
import { useSession } from '../session';
import { useStore } from '../state';
import { listScenarios } from '../world';
import { resolveStep } from './runner';

interface ScenarioBarProps {
  screen: Screen;
  onScreenChange: (screen: Screen) => void;
}

const STEP_INTERVAL_MS = 1500;

/**
 * Out-of-phone scenario player: steps through a scripted sequence of
 * propose/commit calls and ClockSet events, driving the same POV/dispatch
 * levers DevBar exposes to a human. The phone frame just re-renders — nothing
 * here reaches into Phone beyond the screen it's already given.
 */
export function ScenarioBar({ onScreenChange }: ScenarioBarProps) {
  const scenarios = listScenarios();
  const { setPerson, setDevice } = useSession();
  const { state, dispatch } = useStore();
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? '');
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const scenario = scenarios.find((s) => s.id === scenarioId);
  const atEnd = !scenario || stepIndex >= scenario.steps.length;

  function playStep() {
    if (!scenario || stepIndex >= scenario.steps.length) return;
    const result = resolveStep(scenario.steps[stepIndex], state);
    result.events.forEach(dispatch);
    if (result.focus) {
      setPerson(result.focus.personId);
      if (result.focus.deviceId) setDevice(result.focus.deviceId);
    }
    if (result.screen) onScreenChange(result.screen);
    setStepIndex((i) => i + 1);
  }

  useEffect(() => {
    if (!playing || atEnd) {
      if (atEnd) setPlaying(false);
      return;
    }
    const id = setTimeout(playStep, STEP_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [playing, stepIndex, scenarioId, atEnd]);

  function selectScenario(id: string) {
    setScenarioId(id);
    setStepIndex(0);
    setPlaying(false);
  }

  function restart() {
    setStepIndex(0);
    setPlaying(false);
  }

  if (!scenarios.length) return null;

  return (
    <div className="mt-2 flex flex-col items-center gap-2 text-xs text-white/60">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="mr-1 text-white/40">Scenario</span>
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => selectScenario(s.id)}
            title={s.description}
            className={`rounded-full px-2.5 py-1 ${
              s.id === scenarioId
                ? 'bg-white/20 text-white'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {scenario && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-white/5 px-3 py-1">
            Step {Math.min(stepIndex + 1, scenario.steps.length)}/
            {scenario.steps.length}
          </span>
          <button
            onClick={restart}
            className="rounded-full bg-white/5 px-3 py-1 hover:bg-white/10"
          >
            ⏮ Restart
          </button>
          <button
            onClick={playStep}
            disabled={atEnd}
            className="rounded-full bg-white/5 px-3 py-1 hover:bg-white/10 disabled:opacity-40"
          >
            ⏭ Step
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={atEnd}
            className="rounded-full bg-white/5 px-3 py-1 hover:bg-white/10 disabled:opacity-40"
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
        </div>
      )}
    </div>
  );
}
