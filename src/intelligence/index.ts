import { INTELLIGENCE_PROVIDER } from '../config';
import { MockIntelligence } from './mock';
import type { IntelligenceProvider, PersonIntelligence } from './types';

export type {
  IntelligenceProvider,
  PersonIntelligence,
  PhotoGroup,
  ResolvedPerson,
  ShareDraft,
} from './types';

/**
 * Selects the active intelligence provider from config. Add an 'llm' branch here
 * (implementing IntelligenceProvider) to go live without touching the UI.
 */
function createIntelligence(): IntelligenceProvider {
  switch (INTELLIGENCE_PROVIDER) {
    case 'mock':
      return new MockIntelligence();
    default:
      throw new Error(`Unknown intelligence provider: ${INTELLIGENCE_PROVIDER}`);
  }
}

export const intelligence: IntelligenceProvider = createIntelligence();

/** The brain for a given person (shared across that person's devices). */
export function intelligenceFor(personId: string): PersonIntelligence {
  return intelligence.for(personId);
}
