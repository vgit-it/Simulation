import { SIM_NOW } from '../config';

function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Deterministic status bar — time comes from the simulation clock. */
export function StatusBar() {
  return (
    <div className="flex items-center justify-between px-7 pt-3 pb-1 text-text">
      <span className="text-sm font-semibold tabular-nums">
        {formatTime(SIM_NOW)}
      </span>
      <div className="flex items-center gap-1.5 text-[11px] font-medium">
        <span>5G</span>
        <span aria-hidden>▮▮▮▯</span>
        <span
          className="inline-block h-3 w-6 rounded-[3px] border border-text/70 relative"
          aria-label="battery"
        >
          <span className="absolute inset-[2px] right-1.5 rounded-[1px] bg-text/90" />
        </span>
      </div>
    </div>
  );
}
