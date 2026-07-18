import { useState } from 'react';
import { useAutopilot } from './autopilot';
import { SessionProvider } from './session';
import { StoreProvider } from './state';
import { Phone, type Screen } from './phone/Phone';
import { ScreenProvider } from './phone/screen';
import { DevBar } from './phone/DevBar';
import { ScenarioBar } from './scenarios/ScenarioBar';

/**
 * Stage: owns the embodied phone's lock/home/app screen (lifted here, not in
 * Phone, so a human tap (DevBar), the scenario player, and the assistant's plan
 * executor all drive it the same way) and mounts the out-of-phone chrome
 * (DevBar, ScenarioBar). The screen setter is shared with the in-phone
 * assistant via ScreenProvider.
 */
function Stage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'locked' });
  // The world acts back: residents' authored behaviors (auto-reply) fire here.
  useAutopilot();

  return (
    <ScreenProvider value={{ screen, setScreen }}>
      <div className="flex min-h-full flex-col items-center justify-center bg-[#05070d] p-4">
        <Phone screen={screen} onScreenChange={setScreen} />
        <DevBar onScreenChange={setScreen} />
        <ScenarioBar screen={screen} onScreenChange={setScreen} />
      </div>
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
