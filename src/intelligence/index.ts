import { INTELLIGENCE_PROVIDER, SIM_NOW } from '../config';
import { MockIntelligence } from './mock';
import type { IntelligenceProvider } from './types';

export type { IntelligenceProvider, PhotoGroup, ResolvedPerson } from './types';

/**
 * Selects the active intelligence provider from config. Add an 'llm' branch here
 * (implementing IntelligenceProvider) to go live without touching the UI.
 */
function createIntelligence(): IntelligenceProvider {
  switch (INTELLIGENCE_PROVIDER) {
    case 'mock':
      return new MockIntelligence(SIM_NOW);
    default:
      throw new Error(`Unknown intelligence provider: ${INTELLIGENCE_PROVIDER}`);
  }
}

export const intelligence: IntelligenceProvider = createIntelligence();
