import { unreadCountFor, useNow, useStore } from '../state';
import { PillButton } from '../ui';
import { getApp, type Device, type LoadedPerson } from '../world';

/** Sim-clock-driven greeting (never the wall clock — principle 5). */
function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

interface HomeScreenProps {
  owner: LoadedPerson;
  device: Device;
  onOpenApp: (appId: string) => void;
  onLock: () => void;
}

export function HomeScreen({ owner, device, onOpenApp, onLock }: HomeScreenProps) {
  const now = useNow();
  const { state } = useStore();
  // Messages is the one app with a badge source today (unread threads). If a
  // second badged app appears, lift this into a per-app badge registry.
  const unread = unreadCountFor(state, owner.id);
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-b from-surface to-bg px-space-xl pb-space-2xl pt-space-lg">
      {/* The greeting is a brand moment — headline face, room to breathe. */}
      <div className="mb-space-2xl flex animate-rise items-end justify-between">
        <div>
          <p className="type-caption text-muted">{greeting(now.getHours())}</p>
          <p className="type-headline mt-0.5">{owner.name.split(' ')[0]}</p>
        </div>
        <PillButton onClick={onLock}>Lock</PillButton>
      </div>

      <div className="grid grid-cols-4 gap-x-space-lg gap-y-space-xl">
        {device.apps.map((appId, i) => {
          const app = getApp(appId);
          const badge = appId === 'messages' ? unread : 0;
          return (
            <button
              key={appId}
              onClick={() => onOpenApp(appId)}
              className="flex animate-rise flex-col items-center gap-1.5"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="relative flex h-14 w-14 items-center justify-center rounded-card bg-text/10 text-2xl shadow-inner ring-1 ring-text/5 transition-transform duration-150 ease-out-soft active:scale-90">
                {app.icon}
                {badge > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 animate-pop items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white ring-2 ring-bg">
                    {badge}
                  </span>
                )}
              </span>
              <span className="type-caption text-text/90">{app.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex justify-center pt-6">
        <span className="h-1 w-32 rounded-full bg-text/30" />
      </div>
    </div>
  );
}
