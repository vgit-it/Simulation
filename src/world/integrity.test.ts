import { describe, expect, it } from 'vitest';
import { validateIntegrity, world } from './index';
import type { World } from './loader';

describe('world integrity', () => {
  it('the authored world passes integrity validation', () => {
    expect(() => validateIntegrity(world)).not.toThrow();
  });

  it('flags a device referencing an unknown theme', () => {
    const broken: World = {
      design: world.design,
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
          strands: [],
        },
      },
    };
    expect(() => validateIntegrity(broken)).toThrow(/unknown theme "nope"/);
  });

  it('flags a photo referencing an unknown person', () => {
    const broken: World = {
      design: world.design,
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
          strands: [],
        },
      },
    };
    expect(() => validateIntegrity(broken)).toThrow(/unknown person\/contact "ghost"/);
  });

  it('flags a thread referencing a photo that is not in the gallery', () => {
    const broken: World = {
      design: world.design,
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
          gallery: [],
          strands: [
            {
              id: 'ghost-thread',
              title: 'Ghost',
              summary: '',
              status: 'active',
              icon: '🧵',
              items: [
                {
                  source: 'seed:ghost-thread:0',
                  kind: 'photo',
                  at: 0,
                  text: 'missing',
                  refs: ['img-999'],
                },
              ],
            },
          ],
        },
      },
    };
    expect(() => validateIntegrity(broken)).toThrow(/unknown photo "img-999"/);
  });
});
