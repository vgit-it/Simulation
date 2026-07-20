import { useState } from 'react';
import { AssistantControlProvider } from './assistant/control';
import { useAutopilot } from './autopilot';
import { SessionProvider } from './session';
import { StoreProvider } from './state';
import { Phone, type Screen } from './phone/Phone';
import { ScreenProvider } from './phone/screen';
import { ScenarioPlayerProvider } from './scenarios/player';

/**
 * Stage: owns the embodied phone's lock/home/app screen (lifted here, not in
 * Phone, so a human tap, the scenario player, and the assistant's plan
 * executor all drive it the same way). The scenario player provider lives
 * here too, so a playing scenario survives the Settings app that started it
 * closing. The screen setter is shared with the in-phone assistant via
 * ScreenProvider.
 */
function Stage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'locked' });
  // The world acts back: residents' authored behaviors (auto-reply) fire here.
  useAutopilot();

  return (
    <ScreenProvider value={{ screen, setScreen }}>
      <ScenarioPlayerProvider>
        <AssistantControlProvider>
          <div className="flex min-h-full flex-col items-center justify-center bg-[#05070d] p-4">
            <Phone screen={screen} onScreenChange={setScreen} />
          </div>
        </AssistantControlProvider>
      </ScenarioPlayerProvider>
    </ScreenProvider>
  );
}

export function App() {
  return (
    <StoreProvider>
      <SessionProvider>
        <Stage />
      </SessionProvider>
    </StoreProvider>
  );
}
