import {
  GEMINI_MODEL_DEFAULT,
  INTELLIGENCE_PROVIDER,
  type IntelligenceProviderName,
} from '../config';
import { LLMIntelligence } from './llm';
import { GeminiIntelligence } from './llm/gemini';
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

/** localStorage keys for the per-browser Brain settings (Settings ▸ Brain). */
const PROVIDER_KEY = 'sim-intelligence-provider';
const GEMINI_KEY_KEY = 'sim-gemini-api-key';
const GEMINI_MODEL_KEY = 'sim-gemini-model';

/** The active provider name: localStorage override first, then config. */
export function activeProviderName(): IntelligenceProviderName {
  try {
    const stored = localStorage.getItem(PROVIDER_KEY);
    if (stored === 'mock' || stored === 'llm-dry-run' || stored === 'gemini') {
      return stored;
    }
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

// The Gemini key/model are read at call time (not bound at construction), so
// editing them takes effect without a reload — only switching provider reloads.

/** The bring-your-own Gemini API key (stored only in this browser). */
export function geminiApiKey(): string {
  try {
    return localStorage.getItem(GEMINI_KEY_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setGeminiApiKey(key: string): void {
  try {
    localStorage.setItem(GEMINI_KEY_KEY, key);
  } catch {
    // Non-browser — nothing to persist.
  }
}

/** The Gemini model id, defaulting to `GEMINI_MODEL_DEFAULT`. */
export function geminiModel(): string {
  try {
    return localStorage.getItem(GEMINI_MODEL_KEY) || GEMINI_MODEL_DEFAULT;
  } catch {
    return GEMINI_MODEL_DEFAULT;
  }
}

export function setGeminiModel(model: string): void {
  try {
    localStorage.setItem(GEMINI_MODEL_KEY, model);
  } catch {
    // Non-browser — nothing to persist.
  }
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
    case 'gemini':
      return new GeminiIntelligence(mock, geminiApiKey, geminiModel);
  }
}

export const intelligence: IntelligenceProvider = createIntelligence();

/** The brain for a given person (shared across that person's devices). */
export function intelligenceFor(personId: string): PersonIntelligence {
  return intelligence.for(personId);
}
