import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, Plugin } from 'vite';

const assetManifestPlugin = (): Plugin => ({
  name: 'tlamk2-asset-manifest',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url || req.url !== '/asset_map.json') {
        return next();
      }

      const manifestPath = path.resolve(__dirname, 'assets/asset_map.json');
      res.setHeader('Content-Type', 'application/json');
      fs.createReadStream(manifestPath).pipe(res);
      return;
    });
  },
  generateBundle(_, bundle) {
    const manifestPath = path.resolve(__dirname, 'assets/asset_map.json');
    const source = fs.readFileSync(manifestPath);
    const asset = {
      type: 'asset' as const,
      name: 'asset_map.json',
      source,
      fileName: 'asset_map.json',
    };
    (bundle as Record<string, unknown>)['asset_map.json'] = asset;
  },
});

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [assetManifestPlugin()],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, 'src/engine'),
      '@data': path.resolve(__dirname, 'src/data'),
      '@models': path.resolve(__dirname, 'src/models'),
      '@systems': path.resolve(__dirname, 'src/systems'),
    },
  },
  server: {
    watch: {
      ignored: ['**/assets/**', '**/assets_1/**'],
    },
    fs: {
      allow: [path.resolve(__dirname, 'assets'), path.resolve(__dirname, 'assets_1')],
    },
  },
});
