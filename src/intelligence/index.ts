import {
  INTELLIGENCE_PROVIDER,
  type IntelligenceProviderName,
} from '../config';
import { LLMIntelligence } from './llm';
import { MockIntelligence } from './mock';
import type { IntelligenceProvider, PersonIntelligence } from './types';

export type {
  ChatReply,
  ChatTurn,
  IntelligenceProvider,
  PersonIntelligence,
  PhotoGroup,
  ResolvedPerson,
  ShareDraft,
  Suggestion,
} from './types';
export type { LLMRequest, LLMTool } from './llm/prompt';

/** localStorage key for the per-browser provider override (Settings Brain toggle). */
const PROVIDER_KEY = 'sim-intelligence-provider';

/** The active provider name: localStorage override first, then config. */
export function activeProviderName(): IntelligenceProviderName {
  try {
    const stored = localStorage.getItem(PROVIDER_KEY);
    if (stored === 'mock' || stored === 'llm-dry-run') return stored;
  } catch {
    // Non-browser (tests) — fall through to config.
  }
  return INTELLIGENCE_PROVIDER;
}

/** Persist a provider choice and reload so every brain rebinds. */
export function switchProvider(name: IntelligenceProviderName): void {
  localStorage.setItem(PROVIDER_KEY, name);
  location.reload();
}

/**
 * Selects the active intelligence provider. The mock is always the base; the
 * LLM provider wraps it (delegating everything except the decider seam), so
 * the phone stays fully usable — and token-free — in every mode.
 */
function createIntelligence(): IntelligenceProvider {
  const mock = new MockIntelligence();
  switch (activeProviderName()) {
    case 'mock':
      return mock;
    case 'llm-dry-run':
      return new LLMIntelligence(mock);
  }
}

export const intelligence: IntelligenceProvider = createIntelligence();

/** The brain for a given person (shared across that person's devices). */
export function intelligenceFor(personId: string): PersonIntelligence {
  return intelligence.for(personId);
}
