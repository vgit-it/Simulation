import { useEffect, useMemo, useRef, useState } from 'react';
import { getApp, getDesignSystem, getDevice, getPerson, getTheme } from '../world';
import { designToCssVars, themeToCssVars } from '../theme';
import { useSession } from '../session';
import { notificationsFor, useStore } from '../state';
import { appRegistry } from '../apps/registry';
import { Assistant } from '../assistant/Assistant';
import { EXIT, useMountTransition } from '../ui';
import { DeviceFrame } from './DeviceFrame';
import { LockScreen } from './LockScreen';
import { HomeScreen } from './HomeScreen';
import { NavBar } from './NavBar';
import { NotificationShade } from './NotificationShade';

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
 * screen state itself is lifted to the stage (App) so a human tap, the
 * Settings app, and the scenario player all drive it the same way.
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
  // Design-system vars first, theme vars second: the shared OS language is the
  // base layer and a person's theme wins any overlap.
  const themeVars = useMemo(
    () => ({
      ...designToCssVars(getDesignSystem()),
      ...themeToCssVars(getTheme(device.theme)),
    }),
    [device.theme],
  );

  const locked = screen.kind === 'locked';
  const appId = screen.kind === 'app' ? screen.appId : null;
  const lock = useMountTransition(locked, EXIT.lock);
  const app = useMountTransition(appId !== null, EXIT.app);

  // Notifications are a fold over the log for the embodied person; the shade is
  // the unlocked surface for them (the lock screen has its own stack).
  const notifications = useMemo(
    () => notificationsFor(state, session.personId),
    [state, session.personId],
  );
  const [shadeOpen, setShadeOpen] = useState(false);
  const shade = useMountTransition(shadeOpen && !locked, EXIT.shade);
  // Picking up another phone (or locking) closes any open shade.
  useEffect(() => {
    setShadeOpen(false);
  }, [session.personId, locked]);
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

  /** Open an app from the notification shade (tap → app, shade retracts). */
  function openAppFromShade(id: string) {
    setShadeOpen(false);
    openApp(id);
  }

  /** Open an app from a lock-screen notification (unlock straight into it). */
  function openAppFromLock(id: string) {
    hasUnlocked.current = true;
    openApp(id); // setting screen to an app clears `locked`, sliding the lock away
  }

  /** Dismiss all currently-showing notifications (Clear all). */
  function clearNotifications() {
    dispatch({
      type: 'NotificationsCleared',
      at: state.clock,
      person: session.personId,
    });
  }

  const shownAppId = appId ?? lastAppId.current;

  return (
    <DeviceFrame
      themeVars={themeVars}
      overlay={!locked ? <Assistant /> : undefined}
      notificationCount={locked ? 0 : notifications.length}
      onOpenShade={locked ? undefined : () => setShadeOpen(true)}
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

      {/* Nav layer: the 3-button bar sits above home + app screens but below
          the lock layer (z-20), which covers it for free while locked. */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <NavBar />
      </div>

      {/* Notification shade: drops from the top over home/app (z-20). Only
          reachable unlocked, so it never fights the lock layer. */}
      {shade.mounted && !locked && (
        <NotificationShade
          ownerId={session.personId}
          notifications={notifications}
          closing={shade.closing}
          onOpen={openAppFromShade}
          onClear={clearNotifications}
          onClose={() => setShadeOpen(false)}
        />
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
            onOpenApp={openAppFromLock}
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
      <div className="flex h-full flex-col items-center justify-center gap-space-md bg-bg p-space-xl text-center">
        <p className="type-body text-muted">No renderer registered for “{app.name}”.</p>
        <button
          onClick={onClose}
          className="type-label rounded-ds-full bg-accent px-space-lg py-2 text-white transition duration-150 active:scale-95"
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
