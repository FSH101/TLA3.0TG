import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Router } from 'express';

interface AssetMapEntry {
  id: string;
  path_in: string;
  kind: string;
  category: string;
  out_dir: string;
  dirs: number;
  framesPerDir: number;
  size: { maxW: number; maxH: number };
  anchorAvg: { xOff: number; yOff: number };
}

interface AssetResponse {
  id: string;
  folder: string;
  name: string;
  originalPath: string;
  dirs: number;
  framesPerDir: number;
  descriptor: {
    kind: string;
    category: string;
    outDir: string;
    dirs: number;
    framesPerDir: number;
    size: { maxW: number; maxH: number };
    anchorAvg: { xOff: number; yOff: number };
  };
}

const ALLOWED_FOLDERS = new Set(['misc', 'scenery', 'skilldex', 'splash', 'tiles', 'walls']);

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '../../../..');
const assetMapPath = path.join(repoRoot, 'assets', 'asset_map.json');

let cachedCatalog: AssetResponse[] | null = null;

async function loadCatalog(): Promise<AssetResponse[]> {
  if (cachedCatalog) {
    return cachedCatalog;
  }
  const raw = await fs.readFile(assetMapPath, 'utf8');
  const data = JSON.parse(raw) as AssetMapEntry[];
  const catalog: AssetResponse[] = [];
  for (const entry of data) {
    const normalized = normalizeArtPath(entry.path_in);
    if (!normalized) {
      continue;
    }
    const [folder, ...rest] = normalized.split('/');
    if (!folder || !ALLOWED_FOLDERS.has(folder)) {
      continue;
    }
    if (rest.length === 0) {
      continue;
    }
    const baseName = rest[rest.length - 1] ?? '';
    const name = baseName.toUpperCase();
    const id = normalized.replace(/\.frm$/i, '').toLowerCase();
    catalog.push({
      id,
      folder,
      name,
      originalPath: entry.path_in,
      dirs: entry.dirs,
      framesPerDir: entry.framesPerDir,
      descriptor: {
        kind: entry.kind,
        category: entry.category,
        outDir: entry.out_dir,
        dirs: entry.dirs,
        framesPerDir: entry.framesPerDir,
        size: entry.size,
        anchorAvg: entry.anchorAvg,
      },
    });
  }

  catalog.sort((a, b) => {
    if (a.folder === b.folder) {
      return a.name.localeCompare(b.name);
    }
    return a.folder.localeCompare(b.folder);
  });

  cachedCatalog = catalog;
  return catalog;
}

function normalizeArtPath(input: string): string | null {
  if (!input) {
    return null;
  }
  const unified = input.replace(/\\+/g, '/');
  const withoutPrefix = unified.replace(/^art\//i, '');
  return withoutPrefix;
}

const assetsRouter = Router();

assetsRouter.get('/', async (_req, res, next) => {
  try {
    const catalog = await loadCatalog();
    res.json(catalog);
  } catch (error) {
    next(error);
  }
});

export { assetsRouter };
