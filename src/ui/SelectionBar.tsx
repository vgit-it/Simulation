import { PillButton } from './PillButton';

interface SelectionBarProps {
  count: number;
  allSelected: boolean;
  /** Exit selection mode entirely (deselects everything). */
  onClose: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

/**
 * The Android contextual action bar: what a header becomes once a long-press
 * enters multi-select. Swaps in for the app's normal header while selecting
 * (`AppHeader` doesn't render alongside it) — the ✕ exits select mode, the
 * count is the title, and one pill toggles select/deselect-all.
 */
export function SelectionBar({
  count,
  allSelected,
  onClose,
  onSelectAll,
  onDeselectAll,
}: SelectionBarProps) {
  return (
    <header className="flex animate-push items-center gap-space-sm px-space-md py-space-sm">
      <button
        onClick={onClose}
        aria-label="Exit selection"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-full text-text transition duration-150 active:bg-text/10"
      >
        <span aria-hidden className="text-xl leading-none">
          ✕
        </span>
      </button>
      <span className="type-title min-w-0 flex-1 truncate">
        {count} selected
      </span>
      <PillButton onClick={allSelected ? onDeselectAll : onSelectAll}>
        {allSelected ? 'Deselect all' : 'Select all'}
      </PillButton>
    </header>
  );
}
