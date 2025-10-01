import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Router } from 'express';

import { assetIndex, type AssetInfo } from '../assets-index';

interface StoredMapData {
  id: string;
  name?: string;
  hex: { orientation: 'pointy' | 'flat'; size: number };
  size: { w: number; h: number };
  tiles: { q: number; r: number; layer: 'ground' | 'roof'; art: string }[];
  objects: { id: string; q: number; r: number; elev: number; dir: number; art: string }[];
}

interface MapSummary {
  id: string;
  name: string;
  hex: StoredMapData['hex'];
  tiles: number;
  objects: number;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '../../../..');
const mapsDir = path.join(repoRoot, 'assets', 'maps');
const mapsRouter = Router();

mapsRouter.get('/', async (_req, res, next) => {
  try {
    const entries = await fs.readdir(mapsDir, { withFileTypes: true });
    const summaries: MapSummary[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const mapId = entry.name.replace(/\.json$/i, '');
      try {
        const summary = await readMapSummary(mapId);
        summaries.push(summary);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[maps] failed to read ${mapId}:`, error);
      }
    }

    summaries.sort((a, b) => a.name.localeCompare(b.name));
    res.json(summaries);
  } catch (error) {
    next(error);
  }
});

mapsRouter.get('/:id', async (req, res, next) => {
  const mapId = req.params.id;
  try {
    const map = await readMapFile(mapId);
    const assetMetadata = collectAssets(map);
    res.json({ ...map, assets: assetMetadata });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      res.status(404).json({ error: 'MAP_NOT_FOUND' });
      return;
    }
    next(error);
  }
});

async function readMapSummary(mapId: string): Promise<MapSummary> {
  const map = await readMapFile(mapId);
  return {
    id: map.id,
    name: map.name ?? map.id,
    hex: map.hex,
    tiles: map.tiles.length,
    objects: map.objects.length,
  };
}

async function readMapFile(mapId: string): Promise<StoredMapData> {
  if (!/^[\w-]+$/i.test(mapId)) {
    const error = new Error('Invalid map id') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    throw error;
  }
  const filePath = path.join(mapsDir, `${mapId}.json`);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as StoredMapData;
}

function collectAssets(map: StoredMapData): Record<string, AssetInfo> {
  const assets = new Map<string, AssetInfo>();
  const insert = (art: string) => {
    if (assets.has(art)) {
      return;
    }
    const info = assetIndex.getInfo(art);
    if (info) {
      assets.set(art, info);
    }
  };

  for (const tile of map.tiles) {
    insert(tile.art);
  }
  for (const object of map.objects) {
    insert(object.art);
  }

  return Object.fromEntries(assets.entries());
}

export { mapsRouter };
