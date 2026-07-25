import { resolveAsset, resolvePerson } from '../../world';
import { AppHeader } from '../../ui';
import type { Strand, StrandItemKind } from '../../strands';

function timeLabel(at: number): string {
  return new Date(at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const KIND_ICONS: Record<StrandItemKind, string> = {
  note: '📝',
  chat: '✨',
  plan: '🗂️',
  message: '💬',
  reminder: '⏰',
  photo: '🖼️',
};

/**
 * One thread, opened in place: its items oldest-first, so the thread reads as
 * the story of an effort rather than a feed. Photo refs resolve to thumbnails
 * from the owner's gallery; people refs resolve to names.
 */
export function ThreadDetail({
  strand,
  ownerId,
  onBack,
}: {
  strand: Strand;
  ownerId: string;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-bg">
      <AppHeader title={strand.title} onBack={onBack} backLabel="Threads" />

      <div className="flex-1 overflow-y-auto px-space-lg pb-space-xl">
        {strand.summary && (
          <p className="type-body-sm mb-space-md text-muted">{strand.summary}</p>
        )}

        <div className="flex flex-col gap-space-sm">
          {strand.items.map((item, i) => {
            const photos = item.refs
              .map((id) => resolveAsset(ownerId, id))
              .filter((p): p is NonNullable<typeof p> => Boolean(p));
            const people =
              item.kind === 'message'
                ? item.refs
                    .filter((id) => !photos.some((p) => p.id === id))
                    .map((id) => resolvePerson(ownerId, id).name)
                : [];
            return (
              <div
                key={item.source}
                className="flex animate-rise items-start gap-space-md rounded-card bg-surface p-space-md ring-1 ring-text/5"
                style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
              >
                <span className="shrink-0 text-base leading-none">
                  {KIND_ICONS[item.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-body-sm block">{item.text}</span>
                  <span className="type-caption mt-0.5 block text-muted">
                    {timeLabel(item.at)}
                    {people.length > 0 ? ` · ${people.join(', ')}` : ''}
                  </span>
                  {photos.length > 0 && (
                    <span className="mt-space-sm flex items-center gap-1">
                      {photos.slice(0, 3).map((p) => (
                        <img
                          key={p.id}
                          src={p.url}
                          alt=""
                          className="h-14 w-14 rounded-ds-xs object-cover ring-1 ring-text/10"
                        />
                      ))}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
