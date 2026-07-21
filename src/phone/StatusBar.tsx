import { useNow } from '../state';

function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

interface StatusBarProps {
  /** Waiting-notification count (a small accent pill by the clock). */
  notificationCount?: number;
  /** Tapping the bar pulls the notification shade down (unlocked only). */
  onOpenShade?: () => void;
}

/** Deterministic status bar — time comes from the simulation clock. */
export function StatusBar({ notificationCount = 0, onOpenShade }: StatusBarProps) {
  const now = useNow();
  const inner = (
    <>
      <span className="type-label flex items-center gap-1.5 tabular-nums">
        {formatTime(now)}
        {notificationCount > 0 && (
          <span className="flex h-4 min-w-4 animate-pop items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white">
            {notificationCount}
          </span>
        )}
      </span>
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
    </>
  );

  const layout =
    'flex w-full items-center justify-between px-7 pb-1 pt-3 text-text transition-colors duration-500';

  // Unlocked, the whole bar is the pull-down handle for the shade; locked, it's
  // static (the lock screen owns notifications there).
  return onOpenShade ? (
    <button
      type="button"
      onClick={onOpenShade}
      aria-label="Open notifications"
      className={`${layout} select-none`}
    >
      {inner}
    </button>
  ) : (
    <div className={layout}>{inner}</div>
  );
}
