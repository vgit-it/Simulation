import { intelligence } from '../../intelligence';
import type { LoadedPerson, Photo } from '../../world';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface PhotoDetailProps {
  owner: LoadedPerson;
  photo: Photo;
  onBack: () => void;
}

export function PhotoDetail({ owner, photo, onBack }: PhotoDetailProps) {
  // "Who is in this photo" comes from metadata via the intelligence provider —
  // no image analysis.
  const people = intelligence.peopleInPhoto(owner.id, photo);

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center justify-between px-4 py-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-accent"
        >
          <span aria-hidden>‹</span> Photos
        </button>
        <span className="text-xs text-muted">{formatDate(photo.date)}</span>
      </header>

      <div className="px-4">
        <img
          src={photo.url}
          alt={photo.location}
          className="w-full rounded-card object-cover"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <h2 className="text-lg font-semibold">{photo.location}</h2>

        <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
          People
        </h3>
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <span
              key={person.id}
              className="flex items-center gap-1.5 rounded-full bg-text/10 py-1 pl-1.5 pr-3 text-sm"
            >
              <span className="text-base">{person.avatar}</span>
              {person.name}
            </span>
          ))}
        </div>

        {photo.tags.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {photo.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-accent/40 px-2.5 py-0.5 text-xs text-accent"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
