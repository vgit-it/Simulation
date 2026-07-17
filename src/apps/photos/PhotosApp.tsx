import { useMemo, useState } from 'react';
import { propose, type Proposal } from '../../actions';
import { ProposalSheet } from '../../actions/ProposalSheet';
import { assembleContext } from '../../context';
import { intelligenceFor } from '../../intelligence';
import { useSession } from '../../session';
import { useNow, useStore } from '../../state';
import { AppHeader, EmptyState, PillButton, useMountTransition } from '../../ui';
import type { Photo } from '../../world';
import type { AppScreenProps } from '../types';
import { PhotoDetail } from './PhotoDetail';

/**
 * Photos: a time-grouped gallery. Grouping is a "smart" result delegated to the
 * person's brain; the underlying data is the owner's committed gallery. Supports
 * a multi-select mode that shares many photos in one proposal via the pipeline.
 */
export function PhotosApp({ owner, onClose }: AppScreenProps) {
  const { session } = useSession();
  const { state } = useStore();
  const now = useNow();
  const groups = useMemo(
    () => intelligenceFor(owner.id).groupPhotosByTime(owner.gallery, now),
    [owner.id, owner.gallery, now],
  );

  const [openPhoto, setOpenPhoto] = useState<Photo | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const actionBar = useMountTransition(selecting, 300);

  if (openPhoto) {
    return <PhotoDetail photo={openPhoto} onBack={() => setOpenPhoto(null)} />;
  }

  function exitSelect() {
    setSelecting(false);
    setPicked(new Set());
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function shareSelected() {
    const photos = owner.gallery.filter((p) => picked.has(p.id));
    if (!photos.length) return;
    const ctx = assembleContext(session, state, {
      app: 'photos',
      photoIds: photos.map((p) => p.id),
    });
    setProposal(propose('share-photos', ctx, photos));
  }

  // Flat index across groups so the entrance stagger sweeps the whole grid.
  let tileIndex = 0;

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <AppHeader
        title="Photos"
        actions={
          selecting ? (
            <PillButton onClick={exitSelect}>Cancel</PillButton>
          ) : (
            <>
              <PillButton onClick={() => setSelecting(true)}>Select</PillButton>
              <PillButton onClick={onClose}>Home</PillButton>
            </>
          )
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {groups.length === 0 && (
          <EmptyState
            icon="📷"
            title="No photos yet"
            hint="Photos added to this person's gallery appear here."
          />
        )}
        {groups.map((group) => (
          <section key={group.key} className="mb-6">
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted">
              {group.label}
            </h2>
            <div className="grid grid-cols-3 gap-1.5">
              {group.photos.map((photo) => {
                const isPicked = picked.has(photo.id);
                const delay = Math.min(tileIndex++, 12) * 25;
                return (
                  <button
                    key={photo.id}
                    onClick={() =>
                      selecting ? toggle(photo.id) : setOpenPhoto(photo)
                    }
                    className="relative aspect-square animate-rise overflow-hidden rounded-lg bg-surface transition-transform duration-150 active:scale-[0.97]"
                    style={{ animationDelay: `${delay}ms` }}
                  >
                    <img
                      src={photo.url}
                      alt={photo.location}
                      className={`h-full w-full object-cover transition-opacity duration-200 ${
                        selecting && !isPicked ? 'opacity-60' : ''
                      }`}
                    />
                    {selecting && (
                      <span
                        // Re-keying re-fires the pop each time the state flips.
                        key={isPicked ? 'on' : 'off'}
                        className={`absolute right-1.5 top-1.5 flex h-5 w-5 animate-pop items-center justify-center rounded-full border text-[11px] ${
                          isPicked
                            ? 'border-accent bg-accent text-white'
                            : 'border-white/70 bg-black/30 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {actionBar.mounted && (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-text/5 bg-surface/95 px-5 py-4 shadow-sheet backdrop-blur ${
            actionBar.closing ? 'animate-slide-down' : 'animate-slide-up'
          }`}
        >
          <span className="text-sm text-muted">{picked.size} selected</span>
          <PillButton
            variant="accent"
            disabled={picked.size === 0}
            onClick={shareSelected}
          >
            Share
          </PillButton>
        </div>
      )}

      <ProposalSheet
        proposal={proposal}
        onSent={() => {
          setProposal(null);
          exitSelect();
        }}
        onCancel={() => setProposal(null)}
      />
    </div>
  );
}
