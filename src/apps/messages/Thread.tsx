import { useEffect, useRef, useState, type FormEvent } from 'react';
import { commit, propose } from '../../actions';
import { assembleContext } from '../../context';
import { useSession } from '../../session';
import { useStore, type Thread as ThreadData } from '../../state';
import { AppHeader, EXIT, OverlayLayer, PillButton, useMountTransition } from '../../ui';
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
  const { session } = useSession();
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState('');
  const title = thread.participantIds
    .map((id) => resolvePerson(ownerId, id).name)
    .join(', ');

  // Replying is the same send-message capability the assistant plans with —
  // committed directly (no approval sheet) because the user typed it themselves.
  function onReply(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const ctx = assembleContext(session, state, { app: 'messages' });
    commit(
      propose('send-message', ctx, thread.participantIds, { text }),
      dispatch,
    );
    setDraft('');
  }

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

      <div className="flex flex-1 flex-col gap-space-md overflow-y-auto px-space-lg py-space-lg">
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
                <span className="type-caption mb-0.5 ml-1 text-muted">
                  {sender.avatar} {sender.name}
                </span>
              )}
              <div
                className={`type-body max-w-[80%] rounded-ds-md px-3.5 py-2 ${
                  mine
                    ? 'rounded-br-ds-xs bg-accent text-white'
                    : 'rounded-bl-ds-xs bg-surface text-text'
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
              <span className="type-caption mt-0.5 px-1 text-muted">
                {timeLabel(m.at)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onReply}
        className="flex gap-space-sm border-t border-text/5 bg-surface/95 px-space-lg pb-14 pt-space-md backdrop-blur"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message..."
          className="type-body-sm min-w-0 flex-1 rounded-ds-full bg-bg/60 px-space-lg py-2 text-text ring-1 ring-text/10 placeholder:text-muted focus:outline-none"
        />
        <PillButton variant="accent" disabled={!draft.trim()} className="shrink-0">
          Send
        </PillButton>
      </form>

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
            <span className="type-body-sm animate-rise text-white/90">
              {shownZoom.location}
            </span>
          </button>
        </OverlayLayer>
      )}
    </div>
  );
}
