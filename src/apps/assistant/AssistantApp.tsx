import { useMemo } from 'react';
import { useAssistantControl } from '../../assistant/control';
import {
  chatSessionsFor,
  messagesFrom,
  plansFor,
  useStore,
} from '../../state';
import { AppHeader, EmptyState, PillButton } from '../../ui';
import { resolvePerson } from '../../world';
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
 * one thread per request (every fresh invocation minted a new session id).
 * Tapping a thread RESUMES it — the invoked surface opens bound to that
 * conversation (showing its latest reply; the full history feeds the brain);
 * "New" (like invoking the assistant from anywhere else) starts a fresh one.
 * It also carries the assistant's recent-activity record (sent items, plan
 * runs) — the invoked surface faces forward, this app is the memory. The app
 * owns no chat machinery of its own: it just points the shared
 * AssistantControl at a thread.
 */
export function AssistantApp({ owner }: AppScreenProps) {
  const { state } = useStore();
  const control = useAssistantControl();
  const sessions = useMemo(
    () => chatSessionsFor(state, owner.id),
    [state, owner.id],
  );
  const activity = messagesFrom(state, owner.id);
  const planRuns = plansFor(state, owner.id);

  return (
    <div className="flex h-full flex-col bg-bg">
      <AppHeader
        title="Assistant"
        actions={<PillButton onClick={() => control.open()}>✨ New</PillButton>}
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

        {(activity.length > 0 || planRuns.length > 0) && (
          <>
            <h3 className="type-caption mb-space-sm mt-space-xl text-muted">
              Recent activity
            </h3>
            <div className="flex flex-col gap-space-sm">
              {planRuns.map((run) => (
                <div
                  key={run.planId}
                  className="animate-rise rounded-card bg-surface p-space-md ring-1 ring-text/5"
                >
                  <p className="type-caption text-accent">
                    ✨ Plan · {run.outcome} · {run.steps} steps
                    {run.struck ? ` · ${run.struck} struck` : ''}
                    {run.supervision ? ` · ${run.supervision}` : ''}
                  </p>
                  <p className="type-body-sm mt-0.5">{run.goal}</p>
                </div>
              ))}
              {[...activity].reverse().map((m, i) => {
                const names = m.to
                  .map((id) => resolvePerson(owner.id, id).name)
                  .join(', ');
                return (
                  <div
                    key={m.id}
                    className="animate-rise rounded-card bg-surface p-space-md ring-1 ring-text/5"
                    style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
                  >
                    <p className="type-caption text-muted">To {names}</p>
                    <p className="type-body-sm mt-0.5">{m.body}</p>
                    {m.attachments.length > 0 && (
                      <p className="type-caption mt-1 text-accent">
                        📎 {m.attachments.length} photo
                        {m.attachments.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
