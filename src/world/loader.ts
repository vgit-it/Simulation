import { parseFrontmatter, parseYaml } from './frontmatter';
import {
  appDefinitionSchema,
  contactsFileSchema,
  deviceSchema,
  photoMetaSchema,
  profileSchema,
  scenarioSchema,
  themeSchema,
  type AppDefinition,
  type Contact,
  type Device,
  type Photo,
  type Profile,
  type Scenario,
  type Theme,
} from './schema';
import type { z } from 'zod';

/**
 * Loads the entire authored `world/` tree into a typed, validated World object.
 * File discovery is done by Vite's import.meta.glob (build-time), so there is no
 * custom filesystem code and adding content never requires touching this file.
 */

export interface LoadedPerson extends Profile {
  contacts: Contact[];
  devices: Device[];
  gallery: Photo[];
}

export interface World {
  apps: Record<string, AppDefinition>;
  themes: Record<string, Theme>;
  people: Record<string, LoadedPerson>;
  scenarios: Record<string, Scenario>;
}

// --- raw file maps (path -> contents) -------------------------------------
const appFiles = import.meta.glob('/world/apps/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const themeFiles = import.meta.glob('/world/themes/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const profileFiles = import.meta.glob('/world/people/*/profile.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const contactFiles = import.meta.glob('/world/people/*/contacts.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const deviceFiles = import.meta.glob('/world/people/*/devices/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const galleryMetaFiles = import.meta.glob('/world/people/*/files/gallery/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const galleryImageFiles = import.meta.glob('/world/people/*/files/gallery/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const scenarioFiles = import.meta.glob('/world/scenarios/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// --- helpers ---------------------------------------------------------------
function validate<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
  path: string,
): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `Invalid world file "${path}":\n${result.error.issues
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n')}`,
    );
  }
  return result.data;
}

/** `/world/people/ava-chen/devices/phone.md` -> `ava-chen` */
function personIdFromPath(path: string): string {
  return path.split('/')[3];
}

/** `/world/.../img-001.yaml` -> `img-001` */
function baseName(path: string): string {
  return path.split('/').pop()!.replace(/\.[^.]+$/, '');
}

// --- build -----------------------------------------------------------------
function buildWorld(): World {
  const apps: Record<string, AppDefinition> = {};
  for (const [path, raw] of Object.entries(appFiles)) {
    const { data } = parseFrontmatter(raw);
    const app = validate(appDefinitionSchema, data, path);
    apps[app.id] = app;
  }

  const themes: Record<string, Theme> = {};
  for (const [path, raw] of Object.entries(themeFiles)) {
    const { data } = parseFrontmatter(raw);
    const theme = validate(themeSchema, data, path);
    themes[theme.id] = theme;
  }

  // Group per-person pieces by person id.
  const contactsByPerson: Record<string, Contact[]> = {};
  for (const [path, raw] of Object.entries(contactFiles)) {
    const { data } = parseFrontmatter(raw);
    contactsByPerson[personIdFromPath(path)] = validate(
      contactsFileSchema,
      data,
      path,
    ).contacts;
  }

  const devicesByPerson: Record<string, Device[]> = {};
  for (const [path, raw] of Object.entries(deviceFiles)) {
    const { data } = parseFrontmatter(raw);
    const device = validate(deviceSchema, data, path);
    (devicesByPerson[personIdFromPath(path)] ??= []).push(device);
  }

  const galleryByPerson: Record<string, Photo[]> = {};
  for (const [path, raw] of Object.entries(galleryMetaFiles)) {
    const personId = personIdFromPath(path);
    const id = baseName(path);
    const meta = validate(photoMetaSchema, parseYaml(raw), path);
    const imagePath = path.replace(/\.yaml$/, '.svg');
    const url = galleryImageFiles[imagePath];
    if (!url) {
      throw new Error(`Photo "${path}" has no matching image at "${imagePath}"`);
    }
    (galleryByPerson[personId] ??= []).push({ id, url, ...meta });
  }
  // Newest first.
  for (const list of Object.values(galleryByPerson)) {
    list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  const people: Record<string, LoadedPerson> = {};
  for (const [path, raw] of Object.entries(profileFiles)) {
    const { data } = parseFrontmatter(raw);
    const profile = validate(profileSchema, data, path);
    people[profile.id] = {
      ...profile,
      contacts: contactsByPerson[profile.id] ?? [],
      devices: devicesByPerson[profile.id] ?? [],
      gallery: galleryByPerson[profile.id] ?? [],
    };
  }

  const scenarios: Record<string, Scenario> = {};
  for (const [path, raw] of Object.entries(scenarioFiles)) {
    const { data } = parseFrontmatter(raw);
    const scenario = validate(scenarioSchema, data, path);
    scenarios[scenario.id] = scenario;
  }

  return { apps, themes, people, scenarios };
}

/**
 * Cross-reference integrity: individual files are already schema-valid, but ids
 * reference each other across files. Catch dangling references at load with a
 * clear message rather than letting them silently mis-render later.
 */
export function validateIntegrity(w: World): void {
  const errors: string[] = [];
  for (const person of Object.values(w.people)) {
    const known = new Set([
      person.id,
      ...person.contacts.map((c) => c.id),
      ...Object.keys(w.people),
    ]);
    for (const device of person.devices) {
      if (!w.themes[device.theme]) {
        errors.push(
          `${person.id}: device "${device.id}" references unknown theme "${device.theme}"`,
        );
      }
      for (const appId of device.apps) {
        if (!w.apps[appId]) {
          errors.push(
            `${person.id}: device "${device.id}" references unknown app "${appId}"`,
          );
        }
      }
    }
    for (const photo of person.gallery) {
      for (const id of photo.people) {
        if (!known.has(id)) {
          errors.push(
            `${person.id}: photo "${photo.id}" references unknown person/contact "${id}"`,
          );
        }
      }
    }
  }
  for (const scenario of Object.values(w.scenarios)) {
    for (const step of scenario.steps) {
      if (step.kind === 'clock') continue;
      const person = w.people[step.person];
      if (!person) {
        errors.push(
          `scenario "${scenario.id}": step references unknown person "${step.person}"`,
        );
        continue;
      }
      const device = step.device
        ? person.devices.find((d) => d.id === step.device)
        : person.devices[0];
      if (step.device && !device) {
        errors.push(
          `scenario "${scenario.id}": step references unknown device "${step.device}" for "${person.id}"`,
        );
      }
      if (step.kind === 'focus' && typeof step.screen === 'object') {
        const appId = step.screen.app;
        if (!w.apps[appId]) {
          errors.push(
            `scenario "${scenario.id}": step references unknown app "${appId}"`,
          );
        } else if (device && !device.apps.includes(appId)) {
          errors.push(
            `scenario "${scenario.id}": step opens app "${appId}" not installed on ${person.id}'s device "${device.id}"`,
          );
        }
      }
      if (step.kind === 'share') {
        for (const photoId of step.photos) {
          if (!person.gallery.some((p) => p.id === photoId)) {
            errors.push(
              `scenario "${scenario.id}": step shares unknown photo "${photoId}" from ${person.id}'s gallery`,
            );
          }
        }
      }
    }
  }

  if (errors.length) {
    throw new Error(`World integrity errors:\n  - ${errors.join('\n  - ')}`);
  }
}

function loadWorld(): World {
  const w = buildWorld();
  validateIntegrity(w);
  return w;
}

/** The authored seed (read-only). Runtime/mutable state lives in src/state. */
export const world: World = loadWorld();
