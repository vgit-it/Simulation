import type { CSSProperties } from 'react';
import type { Theme } from '../world';

/**
 * Maps a theme's tokens to the CSS custom properties the Tailwind config reads
 * (see tailwind.config.ts). Applied as an inline style on the device frame so a
 * theme is scoped to its device — a future second device can use another theme
 * on the same page.
 */
export function themeToCssVars(theme: Theme): CSSProperties {
  return {
    '--sim-bg': theme.colors.bg,
    '--sim-surface': theme.colors.surface,
    '--sim-text': theme.colors.text,
    '--sim-muted': theme.colors.muted,
    '--sim-accent': theme.colors.accent,
    '--sim-radius-screen': `${theme.radii.screen}px`,
    '--sim-radius-card': `${theme.radii.card}px`,
    '--sim-font': theme.font,
  } as CSSProperties;
}
