import { useState } from 'react';
import { candidate, type Candidate, type Slot } from '../../actions';
import { Avatar } from '../../ui';
import { contactsOf } from '../../world';

interface PickerProps {
  ownerId: string;
  slot: Slot;
  onPick: (c: Candidate) => void;
}

/**
 * The structured answer channel for a `contact` value kind: a tappable list of
 * the owner's contacts (the derived people graph, `contactsOf`). Multi-select —
 * a share can go to several people — with a confirm that yields ONE
 * max-confidence `Candidate` (the picked ids), fed to the same bind path as a
 * typed answer or a confirm chip. Reuses the ContactsApp row look (`Avatar`).
 */
export function ContactPicker({ ownerId, onPick }: PickerProps) {
  const contacts = contactsOf(ownerId);
  const [picked, setPicked] = useState<string[]>([]);
  if (!contacts.length) return null;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="mb-space-md flex max-h-48 flex-col gap-1 overflow-y-auto rounded-card bg-surface/80 p-space-sm ring-1 ring-text/10 backdrop-blur">
      {contacts.map((c) => {
        const on = picked.includes(c.id);
        return (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            className={`flex items-center gap-space-sm rounded-ds-sm px-space-sm py-1.5 text-left transition-colors duration-150 ${
              on ? 'bg-accent/15' : 'active:bg-text/5'
            }`}
          >
            <Avatar emoji={c.avatar} />
            <span className="type-body-sm min-w-0 flex-1 truncate text-text">
              {c.name}
            </span>
            {on && (
              <span className="type-label flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-white">
                ✓
              </span>
            )}
          </button>
        );
      })}
      <button
        disabled={!picked.length}
        onClick={() => onPick(candidate(picked, 'high', 'answer'))}
        className="type-label mt-1 rounded-ds-full bg-accent py-2 text-white transition duration-150 active:scale-95 disabled:opacity-40"
      >
        {picked.length
          ? `Use ${picked.length} contact${picked.length === 1 ? '' : 's'}`
          : 'Pick who to include'}
      </button>
    </div>
  );
}
