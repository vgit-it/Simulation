import { useMemo } from 'react';
import { AppHeader, Avatar, EmptyState, PillButton } from '../../ui';
import { contactsOf, sharedPhotos } from '../../world';
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
      <AppHeader
        title="Contacts"
        actions={<PillButton onClick={onClose}>Home</PillButton>}
      />

      <div className="flex-1 overflow-y-auto px-space-sm pb-space-xl">
        {contacts.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No contacts yet"
            hint="People who share photos with this person appear here."
          />
        ) : (
          <div className="flex flex-col">
            {contacts.map((c, i) => {
              const photos = sharedPhotos(owner.id, c.id);
              return (
                <div
                  key={c.id}
                  className="flex animate-rise items-center gap-space-md rounded-card px-space-md py-space-md transition-colors duration-150 active:bg-text/5"
                  style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
                >
                  <Avatar emoji={c.avatar} />
                  <span className="min-w-0 flex-1">
                    <span className="type-body block truncate font-medium">
                      {c.name}
                    </span>
                    <span className="type-body-sm mt-0.5 block text-muted">
                      In {photos.length} photo{photos.length === 1 ? '' : 's'}{' '}
                      together
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {photos.slice(0, 3).map((p) => (
                      <img
                        key={p.id}
                        src={p.url}
                        alt=""
                        className="h-8 w-8 rounded-ds-xs object-cover ring-1 ring-text/10"
                      />
                    ))}
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
