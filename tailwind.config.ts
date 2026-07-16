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
      },
      fontFamily: {
        sim: 'var(--sim-font)',
      },
    },
  },
  plugins: [],
} satisfies Config;
