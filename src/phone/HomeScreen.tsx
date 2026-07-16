import { getApp, type Device, type LoadedPerson } from '../world';

interface HomeScreenProps {
  owner: LoadedPerson;
  device: Device;
  onOpenApp: (appId: string) => void;
  onLock: () => void;
}

export function HomeScreen({ owner, device, onOpenApp, onLock }: HomeScreenProps) {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-surface to-bg px-6 pb-8 pt-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">Good afternoon</p>
          <p className="text-lg font-semibold">{owner.name}</p>
        </div>
        <button
          onClick={onLock}
          className="rounded-full bg-text/10 px-3 py-1 text-xs text-muted"
        >
          Lock
        </button>
      </div>

      <div className="grid grid-cols-4 gap-x-4 gap-y-6">
        {device.apps.map((appId) => {
          const app = getApp(appId);
          return (
            <button
              key={appId}
              onClick={() => onOpenApp(appId)}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-card bg-text/10 text-2xl shadow-inner active:scale-95">
                {app.icon}
              </span>
              <span className="text-[11px] text-text/90">{app.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex justify-center">
        <span className="h-1 w-32 rounded-full bg-text/30" />
      </div>
    </div>
  );
}
