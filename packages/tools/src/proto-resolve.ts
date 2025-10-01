import path from 'node:path';
import { promises as fs } from 'node:fs';

export interface ProtoLookupResult {
  art: string;
  block: boolean;
}

interface ProtoRecord {
  pid?: number;
  artPath?: string;
  flags?: number;
}

const DEFAULT_UNKNOWN_PREFIX = 'unknown';

const ART_PREFIX = /^art[\\/]/i;

function normalizeArtPath(input: string, pid: number): string {
  const cleaned = input.replace(/^[~\s]+/, '').replace(/[\r\n]/g, '').trim();
  if (!cleaned || cleaned === '0' || cleaned === '-') {
    return `${DEFAULT_UNKNOWN_PREFIX}/${pid}`;
  }
  let forward = cleaned.replace(/\\+/g, '/');
  if (ART_PREFIX.test(forward)) {
    forward = forward.slice(4);
  }
  const dotIndex = forward.lastIndexOf('.');
  if (dotIndex !== -1) {
    forward = forward.slice(0, dotIndex);
  }
  return forward;
}

function deriveBlock(flags?: number): boolean {
  if (typeof flags !== 'number') {
    return false;
  }
  // In classic FOnline protos, flag bit 0x02 means "No block".
  // Treat absence of that bit as blocking geometry.
  const NO_BLOCK_BIT = 0x02;
  return (flags & NO_BLOCK_BIT) === 0;
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walkFiles(full)));
      } else if (entry.isFile() && entry.name.endsWith('.fopro')) {
        files.push(full);
      }
    }),
  );
  return files;
}

export class ProtoResolver {
  private readonly cache = new Map<number, ProtoLookupResult>();
  private loaded = false;

  constructor(private readonly rootDir: string) {}

  async init(): Promise<void> {
    if (this.loaded) {
      return;
    }
    const files = await walkFiles(this.rootDir);
    for (const file of files) {
      await this.loadFile(file);
    }
    this.loaded = true;
  }

  resolve(pid: number): ProtoLookupResult {
    const cached = this.cache.get(pid);
    if (cached) {
      return cached;
    }
    return { art: `${DEFAULT_UNKNOWN_PREFIX}/${pid}`, block: false };
  }

  private async loadFile(file: string): Promise<void> {
    const content = await fs.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/);
    let current: ProtoRecord = {};

    const finalize = () => {
      if (typeof current.pid !== 'number' || Number.isNaN(current.pid)) {
        current = {};
        return;
      }
      if (!current.artPath) {
        this.cache.set(current.pid, {
          art: `${DEFAULT_UNKNOWN_PREFIX}/${current.pid}`,
          block: deriveBlock(current.flags),
        });
      } else {
        this.cache.set(current.pid, {
          art: normalizeArtPath(current.artPath, current.pid),
          block: deriveBlock(current.flags),
        });
      }
      current = {};
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) {
        continue;
      }
      if (line.startsWith('[')) {
        finalize();
        continue;
      }

      const separatorIndex = line.indexOf('=');
      let key: string;
      let value: string;
      if (separatorIndex >= 0) {
        key = line.slice(0, separatorIndex).trim();
        value = line.slice(separatorIndex + 1).trim();
      } else {
        const parts = line.split(/\s+/);
        key = parts.shift() ?? '';
        value = parts.join(' ').trim();
      }

      if (!key) {
        continue;
      }

      switch (key) {
        case 'Pid':
        case 'ProtoId': {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isNaN(parsed)) {
            current.pid = parsed;
          }
          break;
        }
        default: {
          if (key.startsWith('PicMap')) {
            if (value && value !== '0') {
              current.artPath = value;
            }
          } else if (key === 'Flags') {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isNaN(parsed)) {
              current.flags = parsed;
            }
          }
          break;
        }
      }
    }

    finalize();
  }
}
