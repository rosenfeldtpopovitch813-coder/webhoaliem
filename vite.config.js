import { defineConfig } from 'vite';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: { maxParallelFileOps: 2 }
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } }
});
