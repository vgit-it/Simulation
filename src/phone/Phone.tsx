import { useMemo, useState } from 'react';
import { getApp, getDevice, getPerson, getTheme } from '../world';
import { themeToCssVars } from '../theme';
import { appRegistry } from '../apps/registry';
import { DeviceFrame } from './DeviceFrame';
import { LockScreen } from './LockScreen';
import { HomeScreen } from './HomeScreen';

type Screen =
  | { kind: 'locked' }
  | { kind: 'home' }
  | { kind: 'app'; appId: string };

interface PhoneProps {
  personId: string;
  deviceId: string;
}

/** Orchestrates the device: theme + lock/home/app state machine. */
export function Phone({ personId, deviceId }: PhoneProps) {
  const owner = useMemo(() => getPerson(personId), [personId]);
  const device = useMemo(
    () => getDevice(personId, deviceId),
    [personId, deviceId],
  );
  const themeVars = useMemo(
    () => themeToCssVars(getTheme(device.theme)),
    [device.theme],
  );
  const [screen, setScreen] = useState<Screen>({ kind: 'locked' });

  return (
    <DeviceFrame themeVars={themeVars}>
      {screen.kind === 'locked' && (
        <LockScreen owner={owner} onUnlock={() => setScreen({ kind: 'home' })} />
      )}

      {screen.kind === 'home' && (
        <HomeScreen
          owner={owner}
          device={device}
          onOpenApp={(appId) => setScreen({ kind: 'app', appId })}
          onLock={() => setScreen({ kind: 'locked' })}
        />
      )}

      {screen.kind === 'app' &&
        (() => {
          const app = getApp(screen.appId);
          const AppComponent = appRegistry[screen.appId];
          if (!AppComponent) {
            return (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-muted">
                  No renderer registered for “{app.name}”.
                </p>
                <button
                  onClick={() => setScreen({ kind: 'home' })}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
                >
                  Back
                </button>
              </div>
            );
          }
          return (
            <AppComponent
              owner={owner}
              device={device}
              app={app}
              onClose={() => setScreen({ kind: 'home' })}
            />
          );
        })()}
    </DeviceFrame>
  );
}
