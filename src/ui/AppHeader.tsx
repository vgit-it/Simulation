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
 * The two OS header styles: a large-title list header (Photos, Messages,
 * Contacts) and a compact back-navigation header (detail/thread views).
 */
export function AppHeader({ title, onBack, backLabel, actions }: AppHeaderProps) {
  if (onBack) {
    return (
      <header className="flex items-center gap-2 px-space-lg py-space-sm">
        <button
          onClick={onBack}
          className="type-label flex items-center gap-1 text-accent transition duration-150 active:opacity-70"
        >
          <span aria-hidden className="text-base leading-none">‹</span>{' '}
          {backLabel ?? 'Back'}
        </button>
        <span className="type-title ml-1 min-w-0 flex-1 truncate">{title}</span>
        {actions}
      </header>
    );
  }
  return (
    <header className="flex items-center justify-between px-space-lg pb-space-md pt-space-sm">
      <h1 className="type-headline">{title}</h1>
      <div className="flex gap-space-sm">{actions}</div>
    </header>
  );
}
