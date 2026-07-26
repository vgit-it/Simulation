/**
 * Pure drag-resolution math shared by every swipe gesture (unlock, the
 * notification shade, a sheet's swipe-to-dismiss, swiping a notification
 * away): given how far and how fast a pointer moved in the commit direction,
 * decide whether the gesture commits or springs back.
 */

/** Fraction of `extent` a drag must cross to commit outright. */
const COMMIT_FRACTION = 0.25;
/** A flick below the distance threshold still commits above this speed (px/ms). */
const FLICK_VELOCITY = 0.5;

export interface DragResolutionInput {
  /** Distance moved in the commit direction (px). Negative/zero never commits. */
  delta: number;
  /** Elapsed time of the gesture (ms). */
  elapsed: number;
  /** Px distance that counts as "fully dragged". Zero disables the distance rule. */
  extent: number;
}

export function resolveDrag({
  delta,
  elapsed,
  extent,
}: DragResolutionInput): 'commit' | 'cancel' {
  if (delta <= 0) return 'cancel';
  const velocity = elapsed > 0 ? delta / elapsed : 0;
  if (velocity >= FLICK_VELOCITY) return 'commit';
  if (extent > 0 && delta / extent >= COMMIT_FRACTION) return 'commit';
  return 'cancel';
}
