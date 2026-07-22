import type { Candidate } from '../../actions';
import { resolvePerson } from '../../world';

interface ChoiceProps {
  ownerId: string;
  candidates: Candidate[];
  onPick: (c: Candidate) => void;
}

/** Render one candidate for a choice chip: person ids → names, else its text. */
function describe(ownerId: string, c: Candidate): string {
  const v = c.value;
  if (Array.isArray(v)) {
    return v.map((id) => resolvePerson(ownerId, String(id)).name).join(', ');
  }
  return String(v ?? '');
}

/**
 * Disambiguation: when a typed answer parsed to several alternatives ("j" →
 * Jamie? Jordan?), show them as chips. A tap picks one — the same bind path as
 * any other channel. Kind-agnostic: it renders whatever candidates it's given.
 */
export function ChoicePicker({ ownerId, candidates, onPick }: ChoiceProps) {
  return (
    <div className="mb-space-md flex flex-wrap gap-space-sm">
      {candidates.map((c, i) => (
        <button
          key={i}
          onClick={() => onPick(c)}
          className="type-body-sm animate-rise rounded-ds-full bg-surface/80 px-space-lg py-2 text-text ring-1 ring-text/10 backdrop-blur transition duration-150 active:scale-95"
        >
          {describe(ownerId, c)}
        </button>
      ))}
    </div>
  );
}
