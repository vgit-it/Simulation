import { useMemo, useState } from 'react';
import { propose, type Proposal } from '../../actions';
import { ProposalSheet } from '../../actions/ProposalSheet';
import { assembleContext } from '../../context';
import { intelligenceFor } from '../../intelligence';
import { useSession } from '../../session';
import { useNow, useStore } from '../../state';
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

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <header className="flex items-center justify-between px-5 pb-3 pt-2">
        <h1 className="text-2xl font-bold">Photos</h1>
        <div className="flex gap-2">
          {selecting ? (
            <button
              onClick={exitSelect}
              className="rounded-full bg-text/10 px-3 py-1 text-xs text-muted"
            >
              Cancel
            </button>
          ) : (
            <>
              <button
                onClick={() => setSelecting(true)}
                className="rounded-full bg-text/10 px-3 py-1 text-xs text-muted"
              >
                Select
              </button>
              <button
                onClick={onClose}
                className="rounded-full bg-text/10 px-3 py-1 text-xs text-muted"
              >
                Home
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {groups.map((group) => (
          <section key={group.key} className="mb-6">
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted">
              {group.label}
            </h2>
            <div className="grid grid-cols-3 gap-1.5">
              {group.photos.map((photo) => {
                const isPicked = picked.has(photo.id);
                return (
                  <button
                    key={photo.id}
                    onClick={() =>
                      selecting ? toggle(photo.id) : setOpenPhoto(photo)
                    }
                    className="relative aspect-square overflow-hidden rounded-lg bg-surface active:opacity-80"
                  >
                    <img
                      src={photo.url}
                      alt={photo.location}
                      className={`h-full w-full object-cover transition ${
                        selecting && !isPicked ? 'opacity-60' : ''
                      }`}
                    />
                    {selecting && (
                      <span
                        className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
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

      {selecting && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 bg-surface/95 px-5 py-4 backdrop-blur">
          <span className="text-sm text-muted">{picked.size} selected</span>
          <button
            disabled={picked.size === 0}
            onClick={shareSelected}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Share
          </button>
        </div>
      )}

      {proposal && (
        <ProposalSheet
          proposal={proposal}
          onSent={() => {
            setProposal(null);
            exitSelect();
          }}
          onCancel={() => setProposal(null)}
        />
      )}
    </div>
  );
}
