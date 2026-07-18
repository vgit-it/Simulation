import { useEffect, useMemo, useState } from 'react';
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
  const { session, setSelection } = useSession();
  const { state } = useStore();
  const now = useNow();
  const groups = useMemo(
    () => intelligenceFor(owner.id).groupPhotosByTime(owner.gallery, now),
    [owner.id, owner.gallery, now],
  );

  const [openPhoto, setOpenPhoto] = useState<Photo | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const actionBar = useMountTransition(selecting, 300);

  // Picked photos live in the session selection (not local state) so the
  // assistant sees what's selected — "share these" can bind to it.
  const picked = useMemo(
    () =>
      new Set(
        session.selection?.app === 'photos' ? session.selection.ids : [],
      ),
    [session.selection],
  );

  // Leaving the app abandons the selection.
  useEffect(() => () => setSelection(null), [setSelection]);

  if (openPhoto) {
    return <PhotoDetail photo={openPhoto} onBack={() => setOpenPhoto(null)} />;
  }

  function exitSelect() {
    setSelecting(false);
    setSelection(null);
  }

  function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(
      next.size ? { app: 'photos', kind: 'photos', ids: [...next] } : null,
    );
  }

  function shareSelected() {
    const photos = owner.gallery.filter((p) => picked.has(p.id));
    if (!photos.length) return;
    const ctx = assembleContext(session, state, { app: 'photos' });
    setProposal(propose('share-photos', ctx, photos.map((p) => p.id)));
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

      <div className="flex-1 overflow-y-auto px-space-lg pb-24">
        {groups.length === 0 && (
          <EmptyState
            icon="📷"
            title="No photos yet"
            hint="Photos added to this person's gallery appear here."
          />
        )}
        {groups.map((group) => (
          <section key={group.key} className="mb-space-xl">
            <h2 className="type-caption mb-space-sm px-1 text-muted">
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
                    className="relative aspect-square animate-rise overflow-hidden rounded-ds-xs bg-surface transition-transform duration-150 active:scale-[0.97]"
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
          className={`absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-space-md border-t border-text/5 bg-surface/95 px-space-lg py-space-lg shadow-sheet backdrop-blur ${
            actionBar.closing ? 'animate-slide-down' : 'animate-slide-up'
          }`}
        >
          <span className="type-body-sm text-muted">{picked.size} selected</span>
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
