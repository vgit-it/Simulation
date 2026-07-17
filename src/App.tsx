import { useState } from 'react';
import { SessionProvider } from './session';
import { StoreProvider } from './state';
import { Phone, type Screen } from './phone/Phone';
import { DevBar } from './phone/DevBar';
import { ScenarioBar } from './scenarios/ScenarioBar';

/**
 * Stage: owns the embodied phone's lock/home/app screen (lifted here, not in
 * Phone, so both a human tap (DevBar) and the scenario player can drive it the
 * same way) and mounts the out-of-phone chrome (DevBar, ScenarioBar).
 */
function Stage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'locked' });

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#05070d] p-4">
      <Phone screen={screen} onScreenChange={setScreen} />
      <DevBar onScreenChange={setScreen} />
      <ScenarioBar screen={screen} onScreenChange={setScreen} />
    </div>
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
