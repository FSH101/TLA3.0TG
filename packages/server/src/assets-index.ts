import fs from 'node:fs';
import path from 'node:path';

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

interface AssetInfo {
  kind: string;
  category: string;
  outDir: string;
  dirs: number;
  framesPerDir: number;
  size: { maxW: number; maxH: number };
  anchorAvg: { xOff: number; yOff: number };
}

const ASSET_MAP_PATH = path.resolve('assets', 'asset_map.json');
const ASSET_ROOT = path.resolve('assets');

function normalizeKey(input: string): string {
  const normalized = input.replace(/\\+/g, '/');
  const withoutArt = normalized.replace(/^art\//i, '');
  const withoutExt = withoutArt.replace(/\.frm$/i, '');
  return withoutExt.toLowerCase();
}

function padFrame(frame: number): string {
  return frame.toString().padStart(2, '0');
}

class AssetIndex {
  private readonly entries: Map<string, AssetInfo> = new Map<string, AssetInfo>();

  constructor() {
    this.load();
  }

  private load(): void {
    const raw = fs.readFileSync(ASSET_MAP_PATH, 'utf8');
    const data = JSON.parse(raw) as AssetMapEntry[];
    for (const entry of data) {
      const key = normalizeKey(entry.path_in);
      if (!this.entries.has(key)) {
        this.entries.set(key, {
          kind: entry.kind,
          category: entry.category,
          outDir: entry.out_dir,
          dirs: entry.dirs,
          framesPerDir: entry.framesPerDir,
          size: entry.size,
          anchorAvg: entry.anchorAvg,
        });
      }
    }
  }

  public getInfo(artPath: string): AssetInfo | null {
    const key = normalizeKey(artPath);
    return this.entries.get(key) ?? null;
  }

  public resolveFramePath(artPath: string, dir: number, frame: number): string | null {
    const info = this.getInfo(artPath);
    if (!info) {
      return null;
    }

    const safeDir = Number.isFinite(dir) ? Math.max(0, Math.min(dir, Math.max(info.dirs - 1, 0))) : 0;
    const safeFrame = Number.isFinite(frame)
      ? Math.max(0, Math.min(frame, Math.max(info.framesPerDir - 1, 0)))
      : 0;

    const baseDir = path.resolve(ASSET_ROOT, info.outDir);
    const tryDirs = new Set<number>([safeDir, 0]);

    for (const dirCandidate of tryDirs) {
      const frameFile = path.join(baseDir, `dir_${dirCandidate}`, `frame_${padFrame(safeFrame)}.png`);
      if (this.isFile(frameFile)) {
        return frameFile;
      }
    }

    return null;
  }

  private isFile(candidate: string): boolean {
    try {
      const stat = fs.statSync(candidate);
      return stat.isFile();
    } catch (error) {
      return false;
    }
  }
}

export const assetIndex = new AssetIndex();

export type { AssetInfo };
