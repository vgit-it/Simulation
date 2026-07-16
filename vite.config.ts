import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the static build works when served from a GitHub Pages
// project subpath (e.g. /simulation/) without hardcoding the repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
});
