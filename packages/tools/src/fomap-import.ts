import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ProtoResolver, ProtoLookupResult } from './proto-resolve.js';

export interface HexSpec {
  orientation: 'pointy' | 'isometric';
  size: number;
  pixel: {
    tileWidth: number;
    tileHeight: number;
    elevation: number;
  };
}

export interface MapSize {
  w: number;
  h: number;
}

export interface MapTile {
  q: number;
  r: number;
  layer: 'ground' | 'roof';
  art: string;
}

export interface MapObject {
  id: string;
  q: number;
  r: number;
  elev: number;
  dir: number;
  art: string;
  block: boolean;
  offsetX: number;
  offsetY: number;
}

export interface SpawnPoint {
  tag: string;
  q: number;
  r: number;
  elev: number;
}

export interface ImportedMapData {
  id: string;
  hex: HexSpec;
  size: MapSize;
  tiles: MapTile[];
  objects: MapObject[];
  spawns: SpawnPoint[];
}

interface ObjectAccumulator {
  values: Record<string, string>;
}

const DEFAULT_HEX_SIZE = 28;
const FALLBACK_TILE_WIDTH = 80;
const FALLBACK_TILE_HEIGHT = 36;
const FALLBACK_ELEVATION_STEP = 96;
const DEFAULT_SPAWN: SpawnPoint = { tag: 'player_spawn', q: 0, r: 0, elev: 0 };

const SECTION_HEADER = 'header';
const SECTION_TILES = 'tiles';
const SECTION_OBJECTS = 'objects';

function parseKeyValue(rawLine: string): { key: string; value: string } | null {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return null;
  }
  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex >= 0) {
    return {
      key: trimmed.slice(0, equalsIndex).trim(),
      value: trimmed.slice(equalsIndex + 1).trim(),
    };
  }
  const parts = trimmed.split(/\s+/);
  const key = parts.shift();
  if (!key) {
    return null;
  }
  return { key, value: parts.join(' ').trim() };
}

function normalizeArtPath(input: string, fallbackPid: number): string {
  const cleaned = input.replace(/[\r\n"']/g, '').trim();
  if (!cleaned) {
    return `unknown/${fallbackPid}`;
  }
  let forward = cleaned.replace(/\\+/g, '/');
  if (/^art\//i.test(forward)) {
    forward = forward.slice(4);
  }
  const dotIndex = forward.lastIndexOf('.');
  if (dotIndex !== -1) {
    forward = forward.slice(0, dotIndex);
  }
  return forward;
}

function toNumber(value: string | undefined, fallback = 0): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function resolveObjectArt(
  accumulator: Record<string, string>,
  pid: number | undefined,
  protoInfo: ProtoLookupResult | undefined,
): { art: string; block: boolean } {
  const explicit =
    accumulator.PicMapName ??
    accumulator.PicMap ??
    accumulator.PicMapNameExt ??
    accumulator.PicMapNameRu;
  if (explicit) {
    return {
      art: normalizeArtPath(explicit, pid ?? 0),
      block: protoInfo?.block ?? false,
    };
  }
  if (protoInfo) {
    return protoInfo;
  }
  if (typeof pid === 'number' && !Number.isNaN(pid)) {
    return { art: `unknown/${pid}`, block: false };
  }
  return { art: 'unknown/object', block: false };
}

export async function importFomap(
  filePath: string,
  resolver: ProtoResolver,
  hexSize: number = DEFAULT_HEX_SIZE,
): Promise<ImportedMapData> {
  await resolver.init();
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  const tiles: MapTile[] = [];
  const objects: MapObject[] = [];
  const spawns: SpawnPoint[] = [];

  let section = SECTION_HEADER;
  let currentObject: ObjectAccumulator | null = null;
  let width = 0;
  let height = 0;

  const pushObject = () => {
    if (!currentObject) {
      return;
    }
    const values = currentObject.values;
    const pidRaw = values.ProtoId ?? values.Pid;
    const pid = pidRaw ? Number.parseInt(pidRaw, 10) : undefined;
    const protoInfo = typeof pid === 'number' && !Number.isNaN(pid) ? resolver.resolve(pid) : undefined;
    const artInfo = resolveObjectArt(values, pid, protoInfo);
    const q = toNumber(values.MapX ?? values.HexX);
    const r = toNumber(values.MapY ?? values.HexY);
    const elev = toNumber(values.MapElev ?? values.MapZ ?? values.Elev);
    const dir = toNumber(values.Dir ?? values.Angle) % 6;
    const id = values.Id ?? `o${objects.length + 1}`;
    const offsetX = toNumber(values.OffsetX ?? values.OffsX, 0);
    const offsetY = toNumber(values.OffsetY ?? values.OffsY, 0);

    objects.push({
      id,
      q,
      r,
      elev,
      dir,
      art: artInfo.art,
      block: artInfo.block,
      offsetX,
      offsetY,
    });

    currentObject = null;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trimEnd();
    const simple = trimmed.trim();
    if (!simple) {
      if (section === SECTION_OBJECTS) {
        pushObject();
        currentObject = null;
      }
      continue;
    }
    if (simple.startsWith('#') || simple.startsWith('//')) {
      continue;
    }
    if (simple.startsWith('[') && simple.endsWith(']')) {
      if (section === SECTION_OBJECTS) {
        pushObject();
      }
      const next = simple.slice(1, -1).toLowerCase();
      if (next === 'tiles') {
        section = SECTION_TILES;
      } else if (next === 'objects') {
        section = SECTION_OBJECTS;
      } else {
        section = SECTION_HEADER;
      }
      continue;
    }

    if (section === SECTION_HEADER) {
      const kv = parseKeyValue(simple);
      if (!kv) {
        continue;
      }
      if (kv.key === 'MaxHexX') {
        width = toNumber(kv.value, width);
      } else if (kv.key === 'MaxHexY') {
        height = toNumber(kv.value, height);
      }
      continue;
    }

    if (section === SECTION_TILES) {
      const lower = simple.toLowerCase();
      const tileMatch = lower.startsWith('tile');
      const roofMatch = lower.startsWith('roof');
      if (!tileMatch && !roofMatch) {
        continue;
      }
      const match = simple.match(/^(tile|roof)\s+(-?\d+)\s+(-?\d+)\s+(.+)$/i);
      if (!match) {
        continue;
      }
      const [, kind, xRaw, yRaw, artRaw] = match;
      const q = Number.parseInt(xRaw, 10);
      const r = Number.parseInt(yRaw, 10);
      const art = normalizeArtPath(artRaw, 0);
      tiles.push({
        q,
        r,
        layer: kind.toLowerCase() === 'roof' ? 'roof' : 'ground',
        art,
      });
      continue;
    }

    if (section === SECTION_OBJECTS) {
      if (!currentObject) {
        currentObject = { values: {} };
      }
      const kv = parseKeyValue(simple);
      if (!kv) {
        continue;
      }
      currentObject.values[kv.key] = kv.value;
    }
  }

  if (section === SECTION_OBJECTS) {
    pushObject();
  }

  if (spawns.length === 0) {
    spawns.push(DEFAULT_SPAWN);
  }

  const id = path.basename(filePath, path.extname(filePath));

  return {
    id,
    hex: {
      orientation: 'isometric',
      size: hexSize,
      pixel: {
        tileWidth: FALLBACK_TILE_WIDTH,
        tileHeight: FALLBACK_TILE_HEIGHT,
        elevation: FALLBACK_ELEVATION_STEP,
      },
    },
    size: { w: width, h: height },
    tiles,
    objects,
    spawns,
  };
}
