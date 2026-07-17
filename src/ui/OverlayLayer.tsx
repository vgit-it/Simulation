import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-screen overlays (sheets, lightboxes) portal to a container rendered
 * last inside the device screen (see DeviceFrame). This keeps them above the
 * assistant FAB and immune to stacking contexts created by ancestor screen
 * animations, no matter where in the app tree they're declared.
 */
export const OverlayPortalContext = createContext<HTMLElement | null>(null);

export function OverlayLayer({ children }: { children: ReactNode }) {
  const container = useContext(OverlayPortalContext);
  // Before the container ref resolves (first paint) render in place — the
  // overlay still works, it just doesn't get the portal's paint order.
  if (!container) return <>{children}</>;
  return createPortal(children, container);
}
