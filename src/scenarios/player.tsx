import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useScreenControl } from '../phone/screen';
import { useSession } from '../session';
import { useStore } from '../state';
import { listScenarios, type Scenario } from '../world';
import { resolveStep } from './runner';

const STEP_INTERVAL_MS = 1500;

export interface ScenarioPlayer {
  scenarios: Scenario[];
  scenarioId: string;
  scenario: Scenario | undefined;
  /** Index of the next step to run; equals steps.length when finished. */
  stepIndex: number;
  playing: boolean;
  atEnd: boolean;
  select: (scenarioId: string) => void;
  step: () => void;
  toggle: () => void;
  restart: () => void;
}

const ScenarioPlayerContext = createContext<ScenarioPlayer | null>(null);

/**
 * Stage-level scenario playback: steps through a scripted sequence of
 * propose/commit calls and ClockSet events, driving the same POV/dispatch/
 * screen levers the Settings app exposes to a human. Playback state lives
 * here — above the phone — because a `focus` step re-embodies another person
 * and changes the screen, which unmounts the Settings app that pressed Play;
 * the run must survive its own controls disappearing.
 */
export function ScenarioPlayerProvider({ children }: { children: ReactNode }) {
  const scenarios = listScenarios();
  const { setPerson, setDevice } = useSession();
  const { state, dispatch } = useStore();
  const { setScreen } = useScreenControl();
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? '');
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const scenario = scenarios.find((s) => s.id === scenarioId);
  const atEnd = !scenario || stepIndex >= scenario.steps.length;

  function step() {
    if (!scenario || stepIndex >= scenario.steps.length) return;
    const result = resolveStep(scenario.steps[stepIndex], state);
    result.events.forEach(dispatch);
    if (result.focus) {
      setPerson(result.focus.personId);
      if (result.focus.deviceId) setDevice(result.focus.deviceId);
    }
    if (result.screen) setScreen(result.screen);
    setStepIndex((i) => i + 1);
  }

  useEffect(() => {
    if (!playing || atEnd) {
      if (atEnd) setPlaying(false);
      return;
    }
    const id = setTimeout(step, STEP_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [playing, stepIndex, scenarioId, atEnd]);

  function select(id: string) {
    setScenarioId(id);
    setStepIndex(0);
    setPlaying(false);
  }

  function restart() {
    setStepIndex(0);
    setPlaying(false);
  }

  const value: ScenarioPlayer = {
    scenarios,
    scenarioId,
    scenario,
    stepIndex,
    playing,
    atEnd,
    select,
    step,
    toggle: () => setPlaying((p) => !p),
    restart,
  };

  return (
    <ScenarioPlayerContext.Provider value={value}>
      {children}
    </ScenarioPlayerContext.Provider>
  );
}

export function useScenarioPlayer(): ScenarioPlayer {
  const player = useContext(ScenarioPlayerContext);
  if (!player) {
    throw new Error('useScenarioPlayer must be used within ScenarioPlayerProvider');
  }
  return player;
}
