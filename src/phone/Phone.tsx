import { useMemo, useState } from 'react';
import { getApp, getDevice, getPerson, getTheme } from '../world';
import { themeToCssVars } from '../theme';
import { useSession } from '../session';
import { useStore } from '../state';
import { appRegistry } from '../apps/registry';
import { DeviceFrame } from './DeviceFrame';
import { LockScreen } from './LockScreen';
import { HomeScreen } from './HomeScreen';

type Screen =
  | { kind: 'locked' }
  | { kind: 'home' }
  | { kind: 'app'; appId: string };

/** Orchestrates the embodied device: theme + lock/home/app state machine. */
export function Phone() {
  const { session } = useSession();
  const { state, dispatch } = useStore();
  const owner = useMemo(() => getPerson(session.personId), [session.personId]);
  const device = useMemo(
    () => getDevice(session.personId, session.deviceId),
    [session.personId, session.deviceId],
  );
  const themeVars = useMemo(
    () => themeToCssVars(getTheme(device.theme)),
    [device.theme],
  );
  const [screen, setScreen] = useState<Screen>({ kind: 'locked' });

  function openApp(appId: string) {
    dispatch({
      type: 'AppOpened',
      at: state.clock,
      person: session.personId,
      appId,
    });
    setScreen({ kind: 'app', appId });
  }

  return (
    <DeviceFrame themeVars={themeVars}>
      {screen.kind === 'locked' && (
        <LockScreen owner={owner} onUnlock={() => setScreen({ kind: 'home' })} />
      )}

      {screen.kind === 'home' && (
        <HomeScreen
          owner={owner}
          device={device}
          onOpenApp={openApp}
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
