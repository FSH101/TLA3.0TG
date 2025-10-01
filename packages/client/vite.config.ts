import { resolve } from 'node:path';

import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname),
  server: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: false,
    proxy: {
      '/api': {
        target: process.env.VITE_SERVER_ORIGIN ?? 'http://localhost:8080',
        changeOrigin: true,
      },
      '/art': {
        target: process.env.VITE_SERVER_ORIGIN ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
