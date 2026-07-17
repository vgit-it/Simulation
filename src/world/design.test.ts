import { describe, expect, it } from 'vitest';
import { getDesignSystem } from './index';
import { designToCssVars } from '../theme';

describe('design system', () => {
  it('loads with every type role and all font references resolved', () => {
    const design = getDesignSystem();
    const roles = Object.entries(design.typography);
    expect(roles.length).toBeGreaterThan(0);
    for (const [role, type] of roles) {
      // "{fonts.x}" references must have been resolved to concrete stacks.
      expect(type.fontFamily, `typography.${role}`).not.toMatch(/\{fonts\./);
      expect(type.fontFamily.length).toBeGreaterThan(0);
    }
  });

  it('emits a complete CSS variable set for the UI utilities', () => {
    const vars = designToCssVars(getDesignSystem()) as Record<string, string>;
    // One spot check per token group the Tailwind/CSS utilities compile against.
    expect(vars['--type-headline-size']).toMatch(/px$/);
    expect(vars['--type-caption-tracking']).toMatch(/em$/);
    expect(vars['--font-brand']).toContain('Figtree');
    expect(vars['--space-lg']).toBe('16px');
    expect(vars['--rounded-full']).toBe('999px');
  });
});
