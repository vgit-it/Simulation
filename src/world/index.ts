import { world, type LoadedPerson, type World } from './loader';
import type { AppDefinition, Device, Theme } from './schema';

export type { World, LoadedPerson };
export type { AppDefinition, Contact, Device, Theme, Photo } from './schema';
export { world };

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
): { id: string; name: string; avatar: string } {
  if (world.people[personId]) {
    const p = world.people[personId];
    return { id: p.id, name: p.name, avatar: p.avatar };
  }
  const contact = getPerson(ownerId).contacts.find((c) => c.id === personId);
  if (contact) return contact;
  return { id: personId, name: personId, avatar: '❓' };
}
