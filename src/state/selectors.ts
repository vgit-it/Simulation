import type { Fact, Message, RuntimeState } from './reducer';

export function selectNow(state: RuntimeState): Date {
  return new Date(state.clock);
}

/** Messages sent by a person. */
export function messagesFrom(state: RuntimeState, personId: string): Message[] {
  return state.messages.filter((m) => m.from === personId);
}

/** Messages whose attachments include a given asset/photo id. */
export function messagesWithAttachment(
  state: RuntimeState,
  assetId: string,
): Message[] {
  return state.messages.filter((m) => m.attachments.includes(assetId));
}

export function factsFor(state: RuntimeState, personId: string): Fact[] {
  return state.facts[personId] ?? [];
}
