import { useMemo } from 'react';
import { contactsOf, sharedPhotoCount } from '../../world';
import type { AppScreenProps } from '../types';

/**
 * Contacts: the owner's people graph, derived from committed photo metadata
 * (`contactsOf`) — everyone they co-appear with in the world. Not an authored
 * list: add a person to a photo and they show up here, no code. Read-only.
 */
export function ContactsApp({ owner, onClose }: AppScreenProps) {
  const contacts = useMemo(() => contactsOf(owner.id), [owner.id]);

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center justify-between px-5 pb-3 pt-2">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <button
          onClick={onClose}
          className="rounded-full bg-text/10 px-3 py-1 text-xs text-muted"
        >
          Home
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {contacts.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted">
            No contacts yet.
          </p>
        ) : (
          <div className="flex flex-col">
            {contacts.map((c) => {
              const count = sharedPhotoCount(owner.id, c.id);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-card px-3 py-3"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-text/10 text-xl">
                    {c.avatar}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {c.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      In {count} photo{count === 1 ? '' : 's'} together
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
