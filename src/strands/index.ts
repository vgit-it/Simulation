import { consolidatedStrands, type RuntimeState } from '../state';
import { getPerson } from '../world';
import type { Strand, StrandItem } from './types';

/**
 * Strands ("Threads" in the UI): the threads of what a person is trying to do.
 *
 * TWO LAYERS, the same split as everywhere else in this project:
 *  - the AUTHORED SEED — `world/people/<id>/threads.md`, read-only content;
 *  - RUNTIME CONSOLIDATION — a `StrandsConsolidated` event carrying the merged
 *    set the brain produced.
 * `strandsFor` is the one place they meet. This module may read both `world`
 * and `state` (like `src/context`), which is why the merge lives here rather
 * than in `src/state/selectors.ts` — those stay world-free.
 *
 * DELIBERATELY NOT WIRED (this stage is a standing data layer, not an agent
 * input — the boundary is the point):
 *  - Strands are NOT part of `ContextBundle`. The brain sees them only through
 *    the explicit `current` argument to `consolidate`.
 *  - Strands do NOT influence `suggest()`, `plan()`, `respond()` or
 *    `revisePlan()`.
 *  - The Threads app declares NO actions, so `viableCapabilities` — the
 *    assistant's action space — is unchanged; nothing about a strand is
 *    proposable.
 *  - Only `StrandsConsolidated` ever writes strands. No other event touches
 *    them, and nothing back-links a strand to a plan or chat beyond an item's
 *    `source` string.
 * Wiring any of these up is the next stage, when strands get their own
 * interface.
 */

/**
 * This person's strands: the authored seed, overlaid by the most recent
 * consolidation.
 *
 * Merging by id (rather than letting the consolidated set simply replace)
 * means an edit to `threads.md` still shows up for any strand consolidation
 * never touched. `Map` insertion order keeps the result deterministic:
 * authored strands hold their position, consolidated versions replace them in
 * place, and brand-new ones append.
 */
export function strandsFor(state: RuntimeState, personId: string): Strand[] {
  const seed = getPerson(personId).strands;
  const runtime = consolidatedStrands(state, personId);
  if (!runtime) return seed;
  const byId = new Map(seed.map((s) => [s.id, s]));
  for (const s of runtime) byId.set(s.id, s);
  return [...byId.values()];
}

/** Every `source` key already accounted for, across a whole strand set. */
export function assignedSources(strands: Strand[]): Set<string> {
  return new Set(strands.flatMap((s) => s.items.map((i) => i.source)));
}

/** Newest item first — what a strand card shows as its "last activity". */
export function lastActivity(strand: Strand): StrandItem | undefined {
  return strand.items.reduce<StrandItem | undefined>(
    (newest, item) => (!newest || item.at > newest.at ? item : newest),
    undefined,
  );
}

export type { Strand, StrandItem, StrandItemKind, StrandStatus } from './types';
