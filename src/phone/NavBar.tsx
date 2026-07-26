import { useMemo } from 'react';
import { useAssistantControl } from '../assistant/control';
import { assembleContext } from '../context';
import { intelligenceFor } from '../intelligence';
import { useSession } from '../session';
import { useStore } from '../state';
import { useBack, useLongPress } from '../ui';

/** How long the home button must be held before the assistant wakes. */
const HOLD_MS = 450;

interface NavBarProps {
  /** Home: go home, closing the shade/overlays first (Android's Home behavior). */
  onHome: () => void;
}

/**
 * One UI 3-button navigation bar: Recents ||| · Home ○ · Back ◁. Rendered as
 * a bottom layer over home and app screens (the lock layer covers it).
 *
 * - **Back dispatches the shared back-press stack** (`src/ui/back.tsx`):
 *   whatever is topmost — an overlay, the shade, an in-app sub-view, select
 *   mode — handles it; Phone registers the app -> home fallback so Back still
 *   works with nothing else open.
 * - Home taps go home (closing the shade via `onHome`); **press-and-hold
 *   invokes the assistant** — the classic 3-button-nav gesture, replacing the
 *   old floating ✨ button. The beacon halo/dot that lived on the FAB moves
 *   here: it shows when the brain has a suggestion waiting.
 * - Recents is decorative; the prototype has no recents surface.
 */
export function NavBar({ onHome }: NavBarProps) {
  const { back } = useBack();
  const { session } = useSession();
  const { state } = useStore();
  const control = useAssistantControl();

  // Same situated read the assistant surface does: the beacon means "the
  // brain has something for you", and disappears once the log shows it done.
  const suggestions = useMemo(() => {
    const ctx = assembleContext(session, state, {});
    return intelligenceFor(session.personId).suggest(ctx);
  }, [session, state]);

  const longPress = useLongPress(() => control.open(), HOLD_MS);

  const buttonClass =
    'flex h-full flex-1 items-center justify-center text-text/70 transition duration-150 active:scale-95 active:text-text';

  return (
    <nav className="flex h-12 select-none items-center justify-around bg-bg/80 backdrop-blur-sm">
      <button aria-label="Recents (decorative)" className={buttonClass}>
        <span className="flex items-end gap-[3px]" aria-hidden>
          <span className="h-3.5 w-[2.5px] rounded-full bg-current" />
          <span className="h-3.5 w-[2.5px] rounded-full bg-current" />
          <span className="h-3.5 w-[2.5px] rounded-full bg-current" />
        </span>
      </button>

      <button
        aria-label="Home (hold for assistant)"
        {...longPress.handlers}
        onPointerUp={(e) => {
          longPress.handlers.onPointerUp(e);
          if (!longPress.wasLongPress()) onHome();
        }}
        className={buttonClass}
      >
        <span className="relative" aria-hidden>
          {/* Beacon halo: the assistant has something for you (was the FAB's). */}
          {suggestions.length > 0 && (
            <span className="pointer-events-none absolute -inset-2 animate-halo rounded-full border-2 border-accent" />
          )}
          <span className="block h-3.5 w-3.5 rounded-full border-2 border-current" />
          {suggestions.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 animate-pop rounded-full bg-accent" />
          )}
        </span>
      </button>

      <button aria-label="Back" onClick={() => back()} className={buttonClass}>
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M11 2 5 8l6 6" />
        </svg>
      </button>
    </nav>
  );
}
