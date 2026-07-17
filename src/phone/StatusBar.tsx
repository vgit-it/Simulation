import { useNow } from '../state';

function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Deterministic status bar — time comes from the simulation clock. */
export function StatusBar() {
  const now = useNow();
  return (
    <div className="flex items-center justify-between px-7 pb-1 pt-3 text-text transition-colors duration-500">
      <span className="type-label tabular-nums">{formatTime(now)}</span>
      <div className="type-caption flex items-center gap-1.5">
        <span>5G</span>
        {/* CSS-drawn signal bars so they render identically cross-platform. */}
        <span className="flex items-end gap-[2px]" aria-hidden>
          <span className="h-1.5 w-[3px] rounded-sm bg-text/90" />
          <span className="h-2 w-[3px] rounded-sm bg-text/90" />
          <span className="h-2.5 w-[3px] rounded-sm bg-text/90" />
          <span className="h-3 w-[3px] rounded-sm bg-text/30" />
        </span>
        <span
          className="relative inline-block h-3 w-6 rounded-[3px] border border-text/70"
          aria-label="battery"
        >
          <span className="absolute inset-[2px] right-1.5 rounded-[1px] bg-text/90" />
        </span>
      </div>
    </div>
  );
}
