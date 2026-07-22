import type { Candidate, Slot } from '../../actions';
import { ContactPicker } from './ContactPicker';

/**
 * The value-kind → picker registry: the structured answer channel for an elicit
 * (the natural-language channel lives in `src/actions/valueKinds.ts`). Same
 * additive shape as `appId → renderer` and `intent → propose` — add a value
 * kind by dropping a picker component + one line here + the `valueKind:` on the
 * slot. A picker yields a `Candidate` the surface binds exactly like a typed
 * answer.
 */
export interface PickerProps {
  ownerId: string;
  slot: Slot;
  onPick: (c: Candidate) => void;
}
export type PickerComponent = (props: PickerProps) => JSX.Element | null;

const registry: Record<string, PickerComponent> = {
  contact: ContactPicker,
  // photo-set / date: fast-follows — fall through to the free-text input.
};

/** The picker for a value kind, or null (→ the free-text input is the channel). */
export function pickerFor(valueKind?: string): PickerComponent | null {
  return valueKind ? registry[valueKind] ?? null : null;
}

export { ChoicePicker } from './ChoicePicker';
