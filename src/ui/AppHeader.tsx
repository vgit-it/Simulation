import type { ReactNode } from 'react';

interface AppHeaderProps {
  title: string;
  /** When set, renders the compact back-chevron header instead of the large title. */
  onBack?: () => void;
  backLabel?: string;
  /** Right-aligned actions (buttons, timestamps). */
  actions?: ReactNode;
}

/**
 * The two OS header styles, One UI-fashion. The large-title header (Photos,
 * Messages, Contacts) is the expanded collapsing app bar: actions ride the
 * top edge while the title sits centered and low in a tall area, pushing
 * content into thumb reach. The compact header (detail/thread views) is an
 * icon-only back arrow with a left-aligned title.
 */
export function AppHeader({ title, onBack, backLabel, actions }: AppHeaderProps) {
  if (onBack) {
    return (
      <header className="flex items-center gap-space-sm px-space-md py-space-sm">
        <button
          onClick={onBack}
          aria-label={backLabel ? `Back to ${backLabel}` : 'Back'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-full text-text transition duration-150 active:bg-text/10"
        >
          <span aria-hidden className="text-xl leading-none">←</span>
        </button>
        <span className="type-title min-w-0 flex-1 truncate">{title}</span>
        {actions}
      </header>
    );
  }
  return (
    <header className="flex flex-col px-space-lg pb-space-lg pt-space-sm">
      <div className="flex min-h-9 items-center justify-end gap-space-sm">
        {actions}
      </div>
      <h1 className="type-headline mt-space-xl mb-space-sm text-center">{title}</h1>
    </header>
  );
}
