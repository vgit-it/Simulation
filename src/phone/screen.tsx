import { createContext, useContext, type ReactNode } from 'react';
import type { Screen } from './Phone';

/**
 * Read/write access to the embodied phone's lock/home/app screen, which lives
 * in the Stage (App) so a human tap, DevBar, the scenario player, and now the
 * assistant's plan executor all drive it the same way. The assistant is mounted
 * *inside* the phone (the DeviceFrame overlay), so it reaches the lifted screen
 * setter through this context rather than prop-drilling — the seam that lets a
 * plan "tap" through apps without a human clicking.
 */
interface ScreenControl {
  screen: Screen;
  setScreen: (screen: Screen) => void;
}

const ScreenContext = createContext<ScreenControl | null>(null);

export function ScreenProvider({
  value,
  children,
}: {
  value: ScreenControl;
  children: ReactNode;
}) {
  return (
    <ScreenContext.Provider value={value}>{children}</ScreenContext.Provider>
  );
}

export function useScreenControl(): ScreenControl {
  const ctx = useContext(ScreenContext);
  if (!ctx) {
    throw new Error('useScreenControl must be used within <ScreenProvider>');
  }
  return ctx;
}
