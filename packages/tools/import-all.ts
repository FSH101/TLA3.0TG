#!/usr/bin/env tsx
import path from 'node:path';
import { promises as fs } from 'node:fs';
import fg from 'fast-glob';
import { fileURLToPath } from 'node:url';
import { importFomap } from './src/fomap-import.js';
import { ProtoResolver } from './src/proto-resolve.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const DEFAULT_PATTERN = 'external/FOnline-TlaMk2/Server/maps/**/*.fomap';
const OUTPUT_DIR = path.resolve(REPO_ROOT, 'assets', 'maps');
const DEFAULT_PROTO_DIR = path.resolve(REPO_ROOT, 'external', 'FOnline-TlaMk2', 'Server', 'proto');

async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

function parsePattern(args: string[]): { pattern: string; protoRoot: string } {
  let pattern = DEFAULT_PATTERN;
  let protoRoot = DEFAULT_PROTO_DIR;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if ((arg === '--glob' || arg === '--pattern') && args[i + 1]) {
      pattern = args[i + 1];
      i += 1;
    } else if (!arg.startsWith('--')) {
      pattern = arg;
    } else if (arg === '--proto-root' && args[i + 1]) {
      protoRoot = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
    }
  }

  return { pattern, protoRoot };
}

async function main(): Promise<void> {
  const { pattern, protoRoot } = parsePattern(process.argv.slice(2));
  const matches = await fg(pattern, {
    cwd: REPO_ROOT,
    absolute: true,
    onlyFiles: true,
  });

  if (matches.length === 0) {
    console.warn(`[import-all] No .fomap files matched pattern "${pattern}"`);
    return;
  }

  await ensureOutputDir();

  const resolver = new ProtoResolver(protoRoot);
  await resolver.init();

  let totalTiles = 0;
  let totalObjects = 0;
  let totalSpawns = 0;

  for (const file of matches) {
    const data = await importFomap(file, resolver);
    const target = path.join(OUTPUT_DIR, `${data.id}.json`);
    await fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    totalTiles += data.tiles.length;
    totalObjects += data.objects.length;
    totalSpawns += data.spawns.length;
    console.log(
      `[import-all] ${data.id} → ${path.relative(REPO_ROOT, target)} ` +
        `(tiles=${data.tiles.length}, objects=${data.objects.length}, spawns=${data.spawns.length})`,
    );
  }

  console.log(
    `[import-all] Processed ${matches.length} maps (tiles=${totalTiles}, objects=${totalObjects}, spawns=${totalSpawns})`,
  );
}

main().catch((error) => {
  console.error('[import-all] Unexpected error', error);
  process.exitCode = 1;
});
