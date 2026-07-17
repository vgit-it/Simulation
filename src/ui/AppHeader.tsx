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
      <header className="flex items-center gap-2 px-4 py-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-accent transition duration-150 active:opacity-70"
        >
          <span aria-hidden>‹</span> {backLabel ?? 'Back'}
        </button>
        <span className="ml-1 min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
        </span>
        {actions}
      </header>
    );
  }
  return (
    <header className="flex items-center justify-between px-5 pb-3 pt-2">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex gap-2">{actions}</div>
    </header>
  );
}
