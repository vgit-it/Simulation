interface EmptyStateProps {
  icon: string;
  title: string;
  hint?: string;
}

/** Centered empty-list placeholder, shared by every app. */
export function EmptyState({ icon, title, hint }: EmptyStateProps) {
  return (
    <div className="flex animate-rise flex-col items-center gap-2 px-6 py-14 text-center">
      <span className="text-4xl opacity-60">{icon}</span>
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint && <p className="text-xs text-muted/80">{hint}</p>}
    </div>
  );
}
