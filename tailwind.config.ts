import type { Config } from 'tailwindcss';

// Colors/radii/fonts resolve to CSS variables that the active device theme
// sets at runtime (see src/theme). This keeps visual identity data-driven:
// restyling means editing a world/themes/*.md file, not this config.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--sim-bg)',
        surface: 'var(--sim-surface)',
        text: 'var(--sim-text)',
        muted: 'var(--sim-muted)',
        accent: 'var(--sim-accent)',
      },
      borderRadius: {
        screen: 'var(--sim-radius-screen)',
        card: 'var(--sim-radius-card)',
        // Shape scale from the OS design language (world/design/DESIGN.md).
        'ds-xs': 'var(--rounded-xs)',
        'ds-sm': 'var(--rounded-sm)',
        'ds-md': 'var(--rounded-md)',
        'ds-lg': 'var(--rounded-lg)',
        'ds-full': 'var(--rounded-full)',
      },
      fontFamily: {
        sim: 'var(--sim-font)',
        brand: 'var(--font-brand)',
        plain: 'var(--font-plain)',
      },
      // Spacing scale from the OS design language (world/design/DESIGN.md);
      // usable anywhere Tailwind takes a spacing value (p-, gap-, m-, ...).
      spacing: {
        'space-xs': 'var(--space-xs)',
        'space-sm': 'var(--space-sm)',
        'space-md': 'var(--space-md)',
        'space-lg': 'var(--space-lg)',
        'space-xl': 'var(--space-xl)',
        'space-2xl': 'var(--space-2xl)',
      },
      // Motion is OS behavior, deliberately engine-level and uniform across
      // themes; per-person identity stays in world/themes tokens.
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.25, 1, 0.5, 1)',
        sheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      boxShadow: {
        sheet: '0 -8px 32px rgba(0, 0, 0, 0.25)',
        fab: '0 8px 24px -6px rgba(0, 0, 0, 0.35)',
      },
      // Entrances declare only a `from` frame: they animate to the element's
      // natural style, so no transform lingers afterwards (a persisted
      // transform would create a permanent stacking context and break overlay
      // layering). Exits declare only a `to` frame; fill-mode holds it until
      // useMountTransition unmounts the element.
      keyframes: {
        'fade-in': { from: { opacity: '0' } },
        'fade-out': { to: { opacity: '0' } },
        rise: { from: { opacity: '0', transform: 'translateY(12px)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.92)' } },
        'app-out': { to: { opacity: '0', transform: 'scale(0.92)' } },
        'slide-up': { from: { transform: 'translateY(100%)' } },
        'slide-down': { to: { transform: 'translateY(100%)' } },
        // Notification shade, dropping from / retracting to the top edge.
        'shade-in': { from: { transform: 'translateY(-100%)' } },
        'shade-out': { to: { transform: 'translateY(-100%)' } },
        'lock-away': { to: { opacity: '0', transform: 'translateY(-8%)' } },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.4)' },
          '70%': { opacity: '1', transform: 'scale(1.08)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
        push: { from: { opacity: '0', transform: 'translateX(16px)' } },
        // An expanding, fading ring — the "I have something for you" beacon.
        halo: {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '75%, 100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        // One dot of a typing indicator; stagger siblings via animationDelay.
        'dot-bounce': {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.35' },
          '30%': { transform: 'translateY(-3px)', opacity: '1' },
        },
      },
      // 'both' fill-mode everywhere so staggered entrances (inline
      // animationDelay) hold their from-state until the delay elapses.
      animation: {
        'fade-in': 'fade-in 250ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'fade-out': 'fade-out 200ms ease-out both',
        rise: 'rise 350ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'scale-in': 'scale-in 300ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'app-out': 'app-out 250ms cubic-bezier(0.4, 0, 1, 1) both',
        'slide-up': 'slide-up 400ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'slide-down': 'slide-down 300ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'shade-in': 'shade-in 300ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'shade-out': 'shade-out 250ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'lock-away': 'lock-away 350ms cubic-bezier(0.32, 0.72, 0, 1) both',
        pop: 'pop 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        breathe: 'breathe 2.6s ease-in-out infinite',
        push: 'push 250ms cubic-bezier(0.25, 1, 0.5, 1) both',
        halo: 'halo 2.4s cubic-bezier(0.25, 1, 0.5, 1) infinite',
        'dot-bounce': 'dot-bounce 1.1s ease-in-out infinite',
        // Exit for the plan HUD: hold a beat (so "✓ Plan complete" is
        // readable), then fade; useMountTransition unmounts at EXIT.hud.
        'hud-out': 'fade-out 250ms ease-out 450ms both',
      },
    },
  },
  plugins: [],
} satisfies Config;
