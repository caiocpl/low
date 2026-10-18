import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Gera um único HTML autocontido (abre com duplo clique, funciona offline).
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-single', emptyOutDir: true, chunkSizeWarningLimit: 5000 },
});
