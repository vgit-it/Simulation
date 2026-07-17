import { world, validateIntegrity, type LoadedPerson, type World } from './loader';
import type { AppDefinition, Device, Photo, Scenario, Theme } from './schema';

export type { World, LoadedPerson };
export type {
  AppDefinition,
  Contact,
  Device,
  Scenario,
  ScenarioStep,
  Theme,
  Photo,
} from './schema';
export { world, validateIntegrity };

/** A person/contact resolved to the minimal fields the UI needs to render them. */
export interface ResolvedPerson {
  id: string;
  name: string;
  avatar: string;
}

export function getPerson(personId: string): LoadedPerson {
  const person = world.people[personId];
  if (!person) throw new Error(`Unknown person: ${personId}`);
  return person;
}

export function getDevice(personId: string, deviceId: string): Device {
  const device = getPerson(personId).devices.find((d) => d.id === deviceId);
  if (!device) {
    throw new Error(`Unknown device "${deviceId}" for person "${personId}"`);
  }
  return device;
}

export function getApp(appId: string): AppDefinition {
  const app = world.apps[appId];
  if (!app) throw new Error(`Unknown app: ${appId}`);
  return app;
}

export function getTheme(themeId: string): Theme {
  const theme = world.themes[themeId];
  if (!theme) throw new Error(`Unknown theme: ${themeId}`);
  return theme;
}

/**
 * Resolve a person/contact id to a display record. Falls back to the id itself
 * so an unknown reference is visible rather than crashing.
 */
export function resolvePerson(
  ownerId: string,
  personId: string,
): ResolvedPerson {
  if (world.people[personId]) {
    const p = world.people[personId];
    return { id: p.id, name: p.name, avatar: p.avatar };
  }
  const contact = getPerson(ownerId).contacts.find((c) => c.id === personId);
  if (contact) return contact;
  return { id: personId, name: personId, avatar: '❓' };
}

/**
 * The person's contact graph, derived from committed content: every real person
 * in the world who co-appears in one of this person's gallery photos (excluding
 * self), newest-connection first. Contacts are a fact about the world, not an
 * authored list — drop a person into a photo and they become a contact, no code.
 */
export function contactsOf(personId: string): ResolvedPerson[] {
  const owner = getPerson(personId);
  const seen = new Set<string>();
  const contacts: ResolvedPerson[] = [];
  for (const photo of owner.gallery) {
    for (const id of photo.people) {
      if (id === personId || seen.has(id) || !world.people[id]) continue;
      seen.add(id);
      contacts.push(resolvePerson(personId, id));
    }
  }
  return contacts;
}

/** How many of the owner's photos a given contact co-appears in. */
export function sharedPhotoCount(ownerId: string, personId: string): number {
  return getPerson(ownerId).gallery.filter((p) => p.people.includes(personId))
    .length;
}

/**
 * Resolve a shared asset id to the photo it refers to, within its owner's
 * gallery. A share's attachments are owned by the sender, and photo ids are
 * unique within a person, so `(ownerId, assetId)` uniquely identifies the asset
 * even across people — no global asset-id scheme needed yet.
 */
export function resolveAsset(
  ownerId: string,
  assetId: string,
): Photo | undefined {
  return getPerson(ownerId).gallery.find((p) => p.id === assetId);
}

export function getScenario(scenarioId: string): Scenario {
  const scenario = world.scenarios[scenarioId];
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
  return scenario;
}

/** Every authored scenario, in authoring order. */
export function listScenarios(): Scenario[] {
  return Object.values(world.scenarios);
}
