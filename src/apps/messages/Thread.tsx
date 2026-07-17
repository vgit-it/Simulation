import { useEffect, useRef, useState } from 'react';
import { type Thread as ThreadData } from '../../state';
import { AppHeader, EXIT, OverlayLayer, useMountTransition } from '../../ui';
import { resolveAsset, resolvePerson, type Photo } from '../../world';

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
 * resolved to thumbnails from the *sender's* gallery via `resolveAsset`, and
 * open a lightbox on tap.
 */
export function Thread({ thread, ownerId, onBack }: ThreadProps) {
  const title = thread.participantIds
    .map((id) => resolvePerson(ownerId, id).name)
    .join(', ');

  const [zoom, setZoom] = useState<Photo | null>(null);
  const lightbox = useMountTransition(zoom !== null, EXIT.fade);
  const lastZoom = useRef<Photo | null>(null);
  if (zoom) lastZoom.current = zoom;
  const shownZoom = zoom ?? lastZoom.current;

  // Open at the latest message (instant), then follow new arrivals smoothly.
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: firstScroll.current ? 'auto' : 'smooth',
    });
    firstScroll.current = false;
  }, [thread.messages.length]);

  return (
    <div className="relative flex h-full animate-push flex-col bg-bg">
      <div className="border-b border-text/10">
        <AppHeader title={title} onBack={onBack} backLabel="Messages" />
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {thread.messages.map((m, i) => {
          const mine = m.from === ownerId;
          const sender = resolvePerson(ownerId, m.from);
          return (
            <div
              key={m.id}
              className={`flex animate-rise flex-col ${
                mine ? 'items-end' : 'items-start'
              }`}
              style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}
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
                        <button
                          key={assetId}
                          disabled={!photo}
                          onClick={() => photo && setZoom(photo)}
                          className="aspect-square overflow-hidden rounded-md bg-black/20 transition-transform duration-150 active:scale-95"
                        >
                          {photo && (
                            <img
                              src={photo.url}
                              alt={photo.location}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </button>
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
        <div ref={bottomRef} />
      </div>

      {/* Lightbox: tap a thumbnail to view it full-screen; tap anywhere to close. */}
      {lightbox.mounted && shownZoom && (
        <OverlayLayer>
          <button
            aria-label="Close photo"
            onClick={() => setZoom(null)}
            className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 backdrop-blur-sm ${
              lightbox.closing ? 'animate-fade-out' : 'animate-fade-in'
            }`}
          >
            <img
              src={shownZoom.url}
              alt={shownZoom.location}
              className="max-h-[70%] w-full animate-scale-in rounded-card object-contain"
            />
            <span className="animate-rise text-sm text-white/90">
              {shownZoom.location}
            </span>
          </button>
        </OverlayLayer>
      )}
    </div>
  );
}
