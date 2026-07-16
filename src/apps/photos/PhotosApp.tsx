import { useMemo, useState } from 'react';
import { intelligence } from '../../intelligence';
import type { Photo } from '../../world';
import type { AppScreenProps } from '../types';
import { PhotoDetail } from './PhotoDetail';

/**
 * Photos: a time-grouped gallery. Grouping is a "smart" result delegated to the
 * intelligence provider; the underlying data is the owner's committed gallery.
 */
export function PhotosApp({ owner, onClose }: AppScreenProps) {
  const groups = useMemo(
    () => intelligence.groupPhotosByTime(owner.gallery),
    [owner.gallery],
  );
  const [selected, setSelected] = useState<Photo | null>(null);

  if (selected) {
    return (
      <PhotoDetail
        owner={owner}
        photo={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center justify-between px-5 pb-3 pt-2">
        <h1 className="text-2xl font-bold">Photos</h1>
        <button
          onClick={onClose}
          className="rounded-full bg-text/10 px-3 py-1 text-xs text-muted"
        >
          Home
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {groups.map((group) => (
          <section key={group.key} className="mb-6">
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted">
              {group.label}
            </h2>
            <div className="grid grid-cols-3 gap-1.5">
              {group.photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setSelected(photo)}
                  className="aspect-square overflow-hidden rounded-lg bg-surface active:opacity-80"
                >
                  <img
                    src={photo.url}
                    alt={photo.location}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
