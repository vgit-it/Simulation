import { type Thread as ThreadData } from '../../state';
import { resolveAsset, resolvePerson } from '../../world';

function timeLabel(at: number): string {
  return new Date(at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface ThreadProps {
  thread: ThreadData;
  /** The person whose inbox we're viewing (their messages align right). */
  ownerId: string;
  onBack: () => void;
}

/**
 * A single conversation. Messages the viewer sent align right; received ones
 * align left with the sender's name (useful for group threads). Attachments are
 * resolved to thumbnails from the *sender's* gallery via `resolveAsset`.
 */
export function Thread({ thread, ownerId, onBack }: ThreadProps) {
  const title = thread.participantIds
    .map((id) => resolvePerson(ownerId, id).name)
    .join(', ');

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-text/10 px-4 py-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-accent"
        >
          <span aria-hidden>‹</span> Messages
        </button>
        <span className="ml-1 truncate text-sm font-semibold">{title}</span>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {thread.messages.map((m) => {
          const mine = m.from === ownerId;
          const sender = resolvePerson(ownerId, m.from);
          return (
            <div
              key={m.id}
              className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
            >
              {!mine && (
                <span className="mb-0.5 ml-1 text-xs text-muted">
                  {sender.avatar} {sender.name}
                </span>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? 'rounded-br-md bg-accent text-white'
                    : 'rounded-bl-md bg-surface text-text'
                }`}
              >
                <p>{m.body}</p>
                {m.attachments.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {m.attachments.map((assetId) => {
                      const photo = resolveAsset(m.from, assetId);
                      return (
                        <div
                          key={assetId}
                          className="aspect-square overflow-hidden rounded-md bg-black/20"
                        >
                          {photo && (
                            <img
                              src={photo.url}
                              alt={photo.location}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className="mt-0.5 px-1 text-[10px] text-muted">
                {timeLabel(m.at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
