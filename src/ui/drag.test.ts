import { describe, expect, it } from 'vitest';
import { resolveDrag } from './drag';

describe('resolveDrag', () => {
  it('commits once the drag crosses the commit fraction of the extent', () => {
    // 25% of 100 = 25; slow enough that velocity alone wouldn't trigger it.
    expect(resolveDrag({ delta: 30, elapsed: 500, extent: 100 })).toBe(
      'commit',
    );
  });

  it('cancels short of the threshold at a slow speed', () => {
    expect(resolveDrag({ delta: 10, elapsed: 500, extent: 100 })).toBe(
      'cancel',
    );
  });

  it('a fast flick commits even well short of the distance threshold', () => {
    // 10px in 10ms = 1px/ms, above the 0.5px/ms flick speed, and 10px is only
    // 10% of a 100px extent — distance alone would not commit this.
    expect(resolveDrag({ delta: 10, elapsed: 10, extent: 100 })).toBe(
      'commit',
    );
  });

  it('zero or negative delta never commits, even with a zero elapsed time', () => {
    expect(resolveDrag({ delta: 0, elapsed: 0, extent: 100 })).toBe('cancel');
    expect(resolveDrag({ delta: -5, elapsed: 100, extent: 100 })).toBe(
      'cancel',
    );
  });

  it('a zero extent disables the distance rule but a flick still commits', () => {
    expect(resolveDrag({ delta: 50, elapsed: 500, extent: 0 })).toBe('cancel');
    expect(resolveDrag({ delta: 50, elapsed: 10, extent: 0 })).toBe('commit');
  });

  it('exactly at the commit fraction commits', () => {
    expect(resolveDrag({ delta: 25, elapsed: 1000, extent: 100 })).toBe(
      'commit',
    );
  });
});
