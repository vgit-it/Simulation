import type { CSSProperties, ReactNode } from 'react';
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
 * always visible; `children` is the current screen content and scrolls.
 */
export function DeviceFrame({ themeVars, children, overlay }: DeviceFrameProps) {
  return (
    <div
      style={themeVars}
      className="relative h-[844px] max-h-[94vh] w-[390px] max-w-[94vw] rounded-[54px] bg-black p-3 shadow-2xl ring-1 ring-white/10"
    >
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-screen bg-bg font-sim text-text">
        {/* notch */}
        <div className="absolute left-1/2 top-0 z-20 h-7 w-40 -translate-x-1/2 rounded-b-2xl bg-black" />
        <StatusBar />
        <div className="relative flex-1 overflow-y-auto">{children}</div>
        {overlay}
      </div>
    </div>
  );
}
