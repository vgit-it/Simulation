import { useState } from 'react';
import { propose, type Proposal } from '../../actions';
import { ProposalSheet } from '../../actions/ProposalSheet';
import { assembleContext } from '../../context';
import { intelligenceFor } from '../../intelligence';
import { useSession } from '../../session';
import { messagesWithAttachment, useStore } from '../../state';
import { AppHeader, PillButton } from '../../ui';
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
    <div className="relative flex h-full animate-push flex-col bg-bg">
      <AppHeader
        title=""
        onBack={onBack}
        backLabel="Photos"
        actions={
          <span className="type-caption text-muted">{formatDate(photo.date)}</span>
        }
      />

      <div className="px-space-lg">
        <img
          src={photo.url}
          alt={photo.location}
          className="w-full animate-scale-in rounded-card object-cover"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-space-lg py-space-lg">
        <div
          className="flex animate-rise items-center justify-between"
          style={{ animationDelay: '80ms' }}
        >
          <h2 className="type-title">{photo.location}</h2>
          <PillButton variant="accent" onClick={onShare}>
            Share
          </PillButton>
        </div>

        {sharedWith.length > 0 && (
          <p className="type-caption mt-space-sm animate-rise text-muted">
            ✓ Shared with {sharedWith.map((p) => p.name).join(', ')}
          </p>
        )}

        <h3
          className="type-caption mb-space-sm mt-space-xl animate-rise text-muted"
          style={{ animationDelay: '120ms' }}
        >
          People
        </h3>
        <div
          className="flex animate-rise flex-wrap gap-space-sm"
          style={{ animationDelay: '120ms' }}
        >
          {people.map((person) => (
            <span
              key={person.id}
              className="type-body-sm flex items-center gap-1.5 rounded-ds-full bg-text/10 py-1 pl-1.5 pr-3"
            >
              <span className="text-base">{person.avatar}</span>
              {person.name}
            </span>
          ))}
        </div>

        {photo.tags.length > 0 && (
          <div className="animate-rise" style={{ animationDelay: '160ms' }}>
            <h3 className="type-caption mb-space-sm mt-space-xl text-muted">
              Tags
            </h3>
            <div className="flex flex-wrap gap-space-sm">
              {photo.tags.map((tag) => (
                <span
                  key={tag}
                  className="type-caption rounded-ds-full border border-accent/40 px-2.5 py-1 text-accent"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ProposalSheet
        proposal={proposal}
        onSent={() => setProposal(null)}
        onCancel={() => setProposal(null)}
      />
    </div>
  );
}
