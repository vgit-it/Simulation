import type { CSSProperties } from 'react';
import type { DesignSystem, Theme } from '../world';

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

/**
 * Maps the OS design language (world/design/DESIGN.md) to the CSS custom
 * properties the type/spacing/shape utilities read (see tailwind.config.ts and
 * the `.type-*` classes in index.css). Applied on the device frame alongside
 * the theme vars, so the whole visual system is authored content.
 */
export function designToCssVars(design: DesignSystem): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [id, stack] of Object.entries(design.fonts)) {
    vars[`--font-${id}`] = stack;
  }
  for (const [role, type] of Object.entries(design.typography)) {
    vars[`--type-${role}-family`] = type.fontFamily;
    vars[`--type-${role}-size`] = type.fontSize;
    vars[`--type-${role}-weight`] = String(type.fontWeight);
    vars[`--type-${role}-leading`] = String(type.lineHeight);
    vars[`--type-${role}-tracking`] = type.letterSpacing;
  }
  for (const [level, value] of Object.entries(design.spacing)) {
    vars[`--space-${level}`] = value;
  }
  for (const [level, value] of Object.entries(design.rounded)) {
    vars[`--rounded-${level}`] = value;
  }
  return vars as CSSProperties;
}
