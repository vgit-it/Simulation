import { useEffect, useMemo, useRef } from 'react';
import { getApp, getDevice, getPerson, getTheme } from '../world';
import { themeToCssVars } from '../theme';
import { useSession } from '../session';
import { useStore } from '../state';
import { appRegistry } from '../apps/registry';
import { Assistant } from '../assistant/Assistant';
import { EXIT, useMountTransition } from '../ui';
import { DeviceFrame } from './DeviceFrame';
import { LockScreen } from './LockScreen';
import { HomeScreen } from './HomeScreen';

export type Screen =
  | { kind: 'locked' }
  | { kind: 'home' }
  | { kind: 'app'; appId: string };

interface PhoneProps {
  screen: Screen;
  onScreenChange: (screen: Screen) => void;
}

/**
 * Orchestrates the embodied device: theme + the lock/home/app display. The
 * screen state itself is lifted to the stage (App) so a human tap, DevBar, and
 * the scenario player all drive it the same way.
 *
 * Screens render layered like a real phone OS — home is the always-rendered
 * base, apps zoom in above it, and the lock screen covers everything — so each
 * transition (unlock reveal, app open/close) is an animation on one layer.
 */
export function Phone({ screen, onScreenChange }: PhoneProps) {
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

  const locked = screen.kind === 'locked';
  const appId = screen.kind === 'app' ? screen.appId : null;
  const lock = useMountTransition(locked, EXIT.lock);
  const app = useMountTransition(appId !== null, EXIT.app);
  // Keeps the app renderer on screen while its close animation plays.
  const lastAppId = useRef<string | null>(null);
  if (appId) lastAppId.current = appId;
  // The lock screen fades in only when re-locking — on boot (or POV switch) it
  // should simply be there, not cross-fade over home.
  const hasUnlocked = useRef(false);
  useEffect(() => {
    hasUnlocked.current = false;
  }, [session.personId]);

  function openApp(id: string) {
    dispatch({
      type: 'AppOpened',
      at: state.clock,
      person: session.personId,
      appId: id,
    });
    onScreenChange({ kind: 'app', appId: id });
  }

  const shownAppId = appId ?? lastAppId.current;

  return (
    <DeviceFrame
      themeVars={themeVars}
      overlay={!locked ? <Assistant /> : undefined}
    >
      {/* Base layer: home, revealed by unlock and by closing an app. */}
      <HomeScreen
        owner={owner}
        device={device}
        onOpenApp={openApp}
        onLock={() => onScreenChange({ kind: 'locked' })}
      />

      {/* App layer: zooms in over home, scales back down on close. No z-index
          of its own so in-app sheets (z-30) can layer above the assistant FAB
          (z-20) — after the entrance animation it creates no stacking context. */}
      {app.mounted && shownAppId && (
        <div
          className={`absolute inset-0 ${
            app.closing ? 'animate-app-out' : 'animate-scale-in'
          }`}
        >
          <AppLayer
            appId={shownAppId}
            ownerId={session.personId}
            deviceId={session.deviceId}
            onClose={() => onScreenChange({ kind: 'home' })}
          />
        </div>
      )}

      {/* Lock layer: covers everything; slides away on unlock. */}
      {lock.mounted && (
        <div
          className={`absolute inset-0 z-20 ${
            lock.closing
              ? 'animate-lock-away'
              : hasUnlocked.current
                ? 'animate-fade-in'
                : ''
          }`}
        >
          <LockScreen
            owner={owner}
            onUnlock={() => {
              hasUnlocked.current = true;
              onScreenChange({ kind: 'home' });
            }}
          />
        </div>
      )}
    </DeviceFrame>
  );
}

interface AppLayerProps {
  appId: string;
  ownerId: string;
  deviceId: string;
  onClose: () => void;
}

function AppLayer({ appId, ownerId, deviceId, onClose }: AppLayerProps) {
  const app = getApp(appId);
  const AppComponent = appRegistry[appId];
  if (!AppComponent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
        <p className="text-muted">No renderer registered for “{app.name}”.</p>
        <button
          onClick={onClose}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition duration-150 active:scale-95"
        >
          Back
        </button>
      </div>
    );
  }
  return (
    <AppComponent
      owner={getPerson(ownerId)}
      device={getDevice(ownerId, deviceId)}
      app={app}
      onClose={onClose}
    />
  );
}
