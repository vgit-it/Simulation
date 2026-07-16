import { defineConfig } from 'vitest/config';

// Tests are pure (reducer, brain, integrity) and run in Node. They import the
// real world via import.meta.glob, which Vitest supports through Vite.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
