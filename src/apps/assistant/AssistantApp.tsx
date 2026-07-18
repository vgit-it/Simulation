import { useMemo } from 'react';
import { useAssistantControl } from '../../assistant/control';
import { chatSessionsFor, useStore } from '../../state';
import { AppHeader, EmptyState, PillButton } from '../../ui';
import type { AppScreenProps } from '../types';

function timeLabel(at: number): string {
  return new Date(at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * The Assistant app: the owner's conversation history with their assistant,
 * one thread per request (every FAB invocation minted a fresh session id).
 * Tapping a thread RESUMES it — the assistant sheet opens bound to that
 * conversation, so its history is visible and feeds the brain; "New" (like
 * invoking the assistant from anywhere else) starts a fresh one. The app owns
 * no chat machinery of its own: it just points the shared AssistantControl at
 * a thread.
 */
export function AssistantApp({ owner, onClose }: AppScreenProps) {
  const { state } = useStore();
  const control = useAssistantControl();
  const sessions = useMemo(
    () => chatSessionsFor(state, owner.id),
    [state, owner.id],
  );

  return (
    <div className="flex h-full flex-col bg-bg">
      <AppHeader
        title="Assistant"
        actions={
          <>
            <PillButton onClick={() => control.open()}>✨ New</PillButton>
            <PillButton onClick={onClose}>Home</PillButton>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-space-lg pb-space-xl">
        {sessions.length === 0 ? (
          <EmptyState
            icon="✨"
            title="No conversations yet"
            hint="Ask the assistant anything — each request becomes a thread here."
          />
        ) : (
          <div className="flex flex-col gap-space-sm">
            {sessions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => control.open(s.id)}
                className="flex animate-rise items-center gap-space-md rounded-card bg-surface p-space-md text-left ring-1 ring-text/5 transition duration-150 active:scale-[0.98]"
                style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg">
                  ✨
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-body block truncate font-medium">
                    {s.title}
                  </span>
                  <span className="type-body-sm block truncate text-muted">
                    {s.last.role === 'assistant' ? '✨ ' : 'You: '}
                    {s.last.text}
                  </span>
                  <span className="type-caption mt-0.5 block text-muted">
                    {timeLabel(s.last.at)} · {s.turns.length} message
                    {s.turns.length === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
