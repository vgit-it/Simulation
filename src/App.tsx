import { SessionProvider } from './session';
import { StoreProvider } from './state';
import { Phone } from './phone/Phone';
import { DevBar } from './phone/DevBar';

/**
 * Stage: mounts the runtime providers and centers the hero device. Later this
 * can host multiple devices side by side or a person switcher.
 */
export function App() {
  return (
    <StoreProvider>
      <SessionProvider>
        <div className="flex min-h-full flex-col items-center justify-center bg-[#05070d] p-4">
          <Phone />
          <DevBar />
        </div>
      </SessionProvider>
    </StoreProvider>
  );
}
