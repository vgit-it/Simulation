import { useEffect, useRef } from 'react';
import { useAssistantControl } from '../../assistant/control';
import { chatHistoryFor, useStore } from '../../state';
import { AppHeader, PillButton } from '../../ui';

function timeLabel(at: number): string {
  return new Date(at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface ChatThreadProps {
  /** The conversation (session id) to read. */
  sessionId: string;
  title: string;
  ownerId: string;
  onBack: () => void;
}

/**
 * A single assistant conversation, read in-app: the full back-and-forth between
 * the owner and their assistant as chat bubbles (the owner's turns align right,
 * the assistant's left) — the Messages Thread pattern, over `chatHistoryFor`
 * instead of the message log. The app is the record; **Continue** hands off to
 * the invoked surface (bound to this session) to add another turn — that's
 * where the live chat machinery (thinking beat, plans, proposals) lives.
 */
export function ChatThread({ sessionId, title, ownerId, onBack }: ChatThreadProps) {
  const { state } = useStore();
  const control = useAssistantControl();
  const turns = chatHistoryFor(state, ownerId, sessionId);

  // Open at the latest turn (instant), then follow new arrivals smoothly.
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: firstScroll.current ? 'auto' : 'smooth',
    });
    firstScroll.current = false;
  }, [turns.length]);

  return (
    <div className="relative flex h-full animate-push flex-col bg-bg">
      <div className="border-b border-text/10">
        <AppHeader title={title} onBack={onBack} backLabel="Assistant" />
      </div>

      <div className="flex flex-1 flex-col gap-space-md overflow-y-auto px-space-lg py-space-lg">
        {turns.map((t, i) => {
          const mine = t.role === 'user';
          return (
            <div
              key={i}
              className={`flex animate-rise flex-col ${
                mine ? 'items-end' : 'items-start'
              }`}
              style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}
            >
              {!mine && (
                <span className="type-caption mb-0.5 ml-1 text-muted">
                  ✨ Assistant
                </span>
              )}
              <div
                className={`type-body-sm max-w-[85%] whitespace-pre-line rounded-ds-md px-3.5 py-2 ${
                  mine
                    ? 'rounded-br-ds-xs bg-accent text-white'
                    : 'rounded-bl-ds-xs bg-surface text-text'
                }`}
              >
                {t.text}
              </div>
              <span className="type-caption mt-0.5 px-1 text-muted">
                {timeLabel(t.at)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex justify-center border-t border-text/5 bg-surface/95 px-space-lg pb-14 pt-space-md backdrop-blur">
        <PillButton variant="accent" onClick={() => control.open(sessionId)}>
          ✨ Continue conversation
        </PillButton>
      </div>
    </div>
  );
}
