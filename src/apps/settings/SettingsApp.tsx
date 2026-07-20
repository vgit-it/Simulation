import { useState, type ReactNode } from 'react';
import {
  activeProviderName,
  geminiApiKey,
  geminiModel,
  setGeminiApiKey,
  setGeminiModel,
  switchProvider,
} from '../../intelligence';
import type { IntelligenceProviderName } from '../../config';
import { useScreenControl } from '../../phone/screen';
import { useScenarioPlayer } from '../../scenarios/player';
import { useHeroDevices, useSession } from '../../session';
import { buildSessionExport, useNow, useStore } from '../../state';
import { AppHeader, Avatar, EmptyState, PillButton } from '../../ui';
import { world } from '../../world';
import type { AppScreenProps } from '../types';

const BRAIN_LABEL: Record<IntelligenceProviderName, string> = {
  mock: '🧪 Mock brain',
  'llm-dry-run': '🔌 LLM dry-run',
  gemini: '🤖 Gemini',
};

/** Cycle the Brain mode: mock → llm-dry-run → gemini → mock. */
function nextProvider(p: IntelligenceProviderName): IntelligenceProviderName {
  return p === 'mock' ? 'llm-dry-run' : p === 'llm-dry-run' ? 'gemini' : 'mock';
}

function timeLabel(d: Date): string {
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** One UI settings group: a caption label over a continuous rounded card. */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="animate-rise">
      <h2 className="type-caption mb-space-xs px-space-md text-muted">
        {label}
      </h2>
      <div className="rounded-card bg-surface p-space-md ring-1 ring-text/5">
        {children}
      </div>
    </section>
  );
}

/**
 * Settings — the prototype's one deliberate fourth-wall break. Proto Settings
 * hosts the study controls that used to live in out-of-phone chrome (DevBar /
 * ScenarioBar): sim clock, POV + device switcher, brain toggle, reset,
 * session export, and the scenario player. Every value shown is global state
 * (store / session / scenario-player context), so the app can be unmounted
 * under its own feet — a POV switch or a playing scenario closing it loses
 * nothing.
 */
export function SettingsApp(_props: AppScreenProps) {
  const { session, setDevice, setPerson } = useSession();
  const devices = useHeroDevices();
  const now = useNow();
  const { state, dispatch, reset } = useStore();
  const { setScreen } = useScreenControl();
  const player = useScenarioPlayer();
  const people = Object.values(world.people);
  const provider = activeProviderName();
  // Key/model are edited live (localStorage, no reload); only the provider
  // switch reloads. Seed the inputs from storage.
  const [apiKey, setApiKey] = useState(geminiApiKey);
  const [model, setModel] = useState(geminiModel);

  function advanceClock(hours: number) {
    dispatch({
      type: 'ClockSet',
      at: state.clock,
      to: state.clock + hours * 3_600_000,
    });
  }

  // Embodying a different person is "picking up their phone": start from the
  // lock screen so the POV switch reads clearly. This unmounts Settings.
  function switchPerson(personId: string) {
    setPerson(personId);
    setScreen({ kind: 'locked' });
  }

  // Download the study session: the event log + its wall-clock/tap trace.
  function exportSession() {
    const data = buildSessionExport(state, provider);
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
    <div className="flex h-full flex-col bg-bg">
      <AppHeader title="Settings" />

      <div className="flex flex-1 flex-col gap-space-lg overflow-y-auto px-space-lg pb-24">
        <Section label="Simulation">
          <div className="flex items-center justify-between gap-space-md">
            <span className="type-body">🕒 {timeLabel(now)}</span>
            <PillButton onClick={() => advanceClock(1)}>+1h</PillButton>
          </div>
          <p className="type-caption mt-space-sm text-muted">
            Residents may act when time passes.
          </p>
        </Section>

        <Section label="Point of view">
          <div className="flex flex-col divide-y divide-text/5">
            {people.map((p) => {
              const embodied = p.id === session.personId;
              return (
                <button
                  key={p.id}
                  onClick={() => switchPerson(p.id)}
                  className={`flex items-center gap-space-md py-space-sm text-left transition-colors duration-150 active:bg-text/5 ${
                    embodied ? 'text-accent' : ''
                  }`}
                >
                  <Avatar emoji={p.avatar} size="sm" />
                  <span className="type-body flex-1">{p.name}</span>
                  {embodied && (
                    <span className="type-label flex h-5 w-5 shrink-0 animate-pop items-center justify-center rounded-full bg-accent text-[11px] text-white">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {devices.length > 1 && (
            <div className="mt-space-sm flex flex-wrap items-center gap-space-sm border-t border-text/5 pt-space-sm">
              <span className="type-caption text-muted">Device</span>
              {devices.map((d) => (
                <PillButton
                  key={d.id}
                  variant={d.id === session.deviceId ? 'accent' : 'muted'}
                  onClick={() => setDevice(d.id)}
                >
                  {d.name}
                </PillButton>
              ))}
            </div>
          )}
          <p className="type-caption mt-space-sm text-muted">
            Switching hands you their phone, starting from its lock screen.
          </p>
        </Section>

        <Section label="Brain">
          <div className="flex items-center justify-between gap-space-md">
            <span className="type-body">{BRAIN_LABEL[provider]}</span>
            <PillButton onClick={() => switchProvider(nextProvider(provider))}>
              Switch
            </PillButton>
          </div>
          {provider === 'gemini' && (
            <div className="mt-space-md flex flex-col gap-space-sm border-t border-text/5 pt-space-md">
              <label className="type-caption text-muted">API key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setGeminiApiKey(e.target.value);
                }}
                placeholder="Gemini API key"
                autoComplete="off"
                className="type-body-sm min-w-0 rounded-ds-full bg-bg/60 px-space-lg py-2 text-text ring-1 ring-text/10 placeholder:text-muted focus:outline-none"
              />
              <label className="type-caption mt-space-xs text-muted">Model</label>
              <input
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setGeminiModel(e.target.value);
                }}
                placeholder="gemini-flash-latest"
                autoComplete="off"
                className="type-body-sm min-w-0 rounded-ds-full bg-bg/60 px-space-lg py-2 text-text ring-1 ring-text/10 placeholder:text-muted focus:outline-none"
              />
            </div>
          )}
          <p className="type-caption mt-space-sm text-muted">
            Dry-run shows the exact API request a real model would receive — no
            call is made. Gemini sends it for real: your key stays in this
            browser and calls the API directly. Switching brains reloads the
            phone.
          </p>
        </Section>

        <Section label="Data">
          <div className="flex flex-wrap items-center gap-space-sm">
            <PillButton onClick={reset}>↺ Reset world</PillButton>
            <PillButton onClick={exportSession}>⬇ Export session</PillButton>
          </div>
          <p className="type-caption mt-space-sm text-muted">
            Reset clears runtime state (sent messages, tracked facts). Export
            downloads the event log plus its wall-clock/tap trace as JSON.
          </p>
        </Section>

        <Section label="Scenarios">
          {player.scenarios.length === 0 ? (
            <EmptyState
              icon="🎬"
              title="No scenarios"
              hint="Author one in world/scenarios/ and it appears here."
            />
          ) : (
            <>
              <div className="flex flex-col divide-y divide-text/5">
                {player.scenarios.map((s) => {
                  const selected = s.id === player.scenarioId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => player.select(s.id)}
                      className={`flex flex-col gap-0.5 py-space-sm text-left transition-colors duration-150 active:bg-text/5 ${
                        selected ? 'text-accent' : ''
                      }`}
                    >
                      <span className="type-body font-medium">{s.name}</span>
                      <span className="type-caption text-muted">
                        {s.description}
                      </span>
                    </button>
                  );
                })}
              </div>
              {player.scenario && (
                <div className="mt-space-sm flex flex-wrap items-center gap-space-sm border-t border-text/5 pt-space-sm">
                  <span className="type-caption text-muted">
                    Step{' '}
                    {Math.min(
                      player.stepIndex + 1,
                      player.scenario.steps.length,
                    )}
                    /{player.scenario.steps.length}
                  </span>
                  <PillButton onClick={player.restart}>⏮ Restart</PillButton>
                  <PillButton onClick={player.step} disabled={player.atEnd}>
                    ⏭ Step
                  </PillButton>
                  <PillButton
                    variant={player.playing ? 'accent' : 'muted'}
                    onClick={player.toggle}
                    disabled={player.atEnd}
                  >
                    {player.playing ? '⏸ Pause' : '▶ Play'}
                  </PillButton>
                </div>
              )}
              <p className="type-caption mt-space-sm text-muted">
                Playing hands the phone to the scripted person — Settings will
                close; playback continues.
              </p>
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
