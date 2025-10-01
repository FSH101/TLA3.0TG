import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'vite';

const interfaceAssetDir = path.resolve(
  __dirname,
  '../external/FOnline-TlaMk2/Client/data/art/intrface'
);

export default defineConfig({
  server: {
    port: 5173,
    fs: {
      // Allow serving files from the repository root so dev mode can reach the
      // original interface assets without copying them into the client package.
      allow: ['..']
    },
    configureServer(server) {
      server.middlewares.use('/interface-assets', (req, res, next) => {
        const requestPath = decodeURIComponent(req.url ?? '');
        const filePath = path.join(interfaceAssetDir, requestPath);
        if (!filePath.startsWith(interfaceAssetDir)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        fs.stat(filePath, (statError, stats) => {
          if (statError || !stats.isFile()) {
            next();
            return;
          }
          res.setHeader('Cache-Control', 'public, max-age=3600');
          const stream = fs.createReadStream(filePath);
          stream.on('error', () => next());
          stream.pipe(res);
        });
      });
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
