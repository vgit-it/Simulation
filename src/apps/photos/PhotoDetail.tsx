import { useState } from 'react';
import { propose, type Proposal } from '../../actions';
import { ProposalSheet } from '../../actions/ProposalSheet';
import { assembleContext } from '../../context';
import { intelligenceFor } from '../../intelligence';
import { useSession } from '../../session';
import { messagesWithAttachment, useStore } from '../../state';
import { resolvePerson, type Photo } from '../../world';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface PhotoDetailProps {
  photo: Photo;
  onBack: () => void;
}

export function PhotoDetail({ photo, onBack }: PhotoDetailProps) {
  const { session } = useSession();
  const { state } = useStore();
  const [proposal, setProposal] = useState<Proposal | null>(null);

  // "Who is in this photo" comes from metadata via the person's brain — no
  // image analysis.
  const people = intelligenceFor(session.personId).peopleInPhoto(photo);

  // Persisted history: has this photo already been shared? (survives reloads)
  const shares = messagesWithAttachment(state, photo.id);
  const sharedWith = [
    ...new Set(shares.flatMap((m) => m.to)),
  ].map((id) => resolvePerson(session.personId, id));

  function onShare() {
    const ctx = assembleContext(session, state, {
      app: 'photos',
      photoIds: [photo.id],
    });
    setProposal(propose('share-photos', ctx, [photo]));
  }

  return (
    <div className="relative flex h-full flex-col bg-bg">
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{photo.location}</h2>
          <button
            onClick={onShare}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white active:opacity-80"
          >
            Share
          </button>
        </div>

        {sharedWith.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            ✓ Shared with {sharedWith.map((p) => p.name).join(', ')}
          </p>
        )}

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

      {proposal && (
        <ProposalSheet
          proposal={proposal}
          onSent={() => setProposal(null)}
          onCancel={() => setProposal(null)}
        />
      )}
    </div>
  );
}
