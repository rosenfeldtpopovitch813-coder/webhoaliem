import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build the full Lớp học Mực renderer as a same-origin sub-application.
// Keep the existing HTVVM dist output; this config writes only to dist/focus-notes.
export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [react()],
  build: { outDir: '../dist/focus-notes', emptyOutDir: false },
});
