import { describe, expect, it } from 'vitest';
import { validateIntegrity, world } from './index';
import type { World } from './loader';

describe('world integrity', () => {
  it('the authored world passes integrity validation', () => {
    expect(() => validateIntegrity(world)).not.toThrow();
  });

  it('flags a device referencing an unknown theme', () => {
    const broken: World = {
      apps: { photos: world.apps.photos },
      themes: {},
      scenarios: {},
      people: {
        x: {
          id: 'x',
          name: 'X',
          avatar: '🙂',
          traits: [],
          behaviors: {},
          contacts: [],
          devices: [
            { id: 'd', type: 'phone', name: 'D', theme: 'nope', apps: [] },
          ],
          gallery: [],
        },
      },
    };
    expect(() => validateIntegrity(broken)).toThrow(/unknown theme "nope"/);
  });

  it('flags a photo referencing an unknown person', () => {
    const broken: World = {
      apps: {},
      themes: {},
      scenarios: {},
      people: {
        x: {
          id: 'x',
          name: 'X',
          avatar: '🙂',
          traits: [],
          behaviors: {},
          contacts: [],
          devices: [],
          gallery: [
            {
              id: 'p1',
              url: 'p1.svg',
              date: new Date(),
              location: '',
              people: ['ghost'],
              tags: [],
            },
          ],
        },
      },
    };
    expect(() => validateIntegrity(broken)).toThrow(/unknown person\/contact "ghost"/);
  });
});
