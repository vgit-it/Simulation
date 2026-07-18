import { useState, type CSSProperties, type ReactNode } from 'react';
import { countTap } from '../state';
import { OverlayPortalContext } from '../ui';
import { StatusBar } from './StatusBar';

interface DeviceFrameProps {
  themeVars: CSSProperties;
  children: ReactNode;
  /**
   * Rendered inside the screen but OUTSIDE the scroller, so it stays pinned to
   * the screen regardless of content scroll (e.g. the floating assistant).
   */
  overlay?: ReactNode;
}

/**
 * The physical phone shell: bezel, notch, and a themed screen. The status bar is
 * always visible; `children` is the current screen content. Full-screen
 * overlays (sheets, lightboxes) portal into a container rendered last so they
 * always paint above screens and the assistant (see OverlayLayer).
 */
export function DeviceFrame({ themeVars, children, overlay }: DeviceFrameProps) {
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);
  return (
    <div
      style={themeVars}
      className="relative h-[844px] max-h-[94vh] w-[390px] max-w-[94vw] rounded-[54px] bg-black p-3 shadow-2xl ring-1 ring-white/10"
    >
      {/* transition-colors lets themes cross-blend when the POV switches.
          Capture-phase tap counting feeds the research trace: every physical
          interaction with the screen counts, out-of-phone chrome doesn't. */}
      <div
        onPointerDownCapture={countTap}
        className="relative flex h-full w-full flex-col overflow-hidden rounded-screen bg-bg font-sim text-text transition-colors duration-500"
      >
        {/* notch */}
        <div className="absolute left-1/2 top-0 z-20 h-7 w-40 -translate-x-1/2 rounded-b-2xl bg-black" />
        <StatusBar />
        <OverlayPortalContext.Provider value={portalEl}>
          {/* Screens are layered (home base, app, lock) and each manages its
              own scrolling, so this container just clips. */}
          <div className="relative flex-1 overflow-hidden">{children}</div>
          {overlay}
          {/* Overlay portal target — last child, so portaled overlays paint
              above everything else on the screen. */}
          <div ref={setPortalEl} />
        </OverlayPortalContext.Provider>
      </div>
    </div>
  );
}
