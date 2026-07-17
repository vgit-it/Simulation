interface EmptyStateProps {
  icon: string;
  title: string;
  hint?: string;
}

/** Centered empty-list placeholder, shared by every app. */
export function EmptyState({ icon, title, hint }: EmptyStateProps) {
  return (
    <div className="flex animate-rise flex-col items-center gap-space-sm px-space-xl py-14 text-center">
      <span className="text-4xl opacity-60">{icon}</span>
      <p className="type-title text-muted">{title}</p>
      {hint && <p className="type-body-sm text-muted/80">{hint}</p>}
    </div>
  );
}
