import { useNow } from '../state';
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
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-b from-surface to-bg px-6 pb-8 pt-4">
      <div className="mb-6 flex animate-rise items-center justify-between">
        <div>
          <p className="text-xs text-muted">{greeting(now.getHours())}</p>
          <p className="text-lg font-semibold">{owner.name}</p>
        </div>
        <PillButton onClick={onLock}>Lock</PillButton>
      </div>

      <div className="grid grid-cols-4 gap-x-4 gap-y-6">
        {device.apps.map((appId, i) => {
          const app = getApp(appId);
          return (
            <button
              key={appId}
              onClick={() => onOpenApp(appId)}
              className="flex animate-rise flex-col items-center gap-1.5"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-card bg-text/10 text-2xl shadow-inner ring-1 ring-text/5 transition-transform duration-150 ease-out-soft active:scale-90">
                {app.icon}
              </span>
              <span className="text-[11px] text-text/90">{app.name}</span>
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
