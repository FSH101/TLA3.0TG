#!/usr/bin/env tsx
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { importFomap } from './src/fomap-import.js';
import { ProtoResolver } from './src/proto-resolve.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_MAPS_DIR = path.resolve(REPO_ROOT, 'external', 'FOnline-TlaMk2', 'Server', 'maps');
const DEFAULT_PROTO_DIR = path.resolve(REPO_ROOT, 'external', 'FOnline-TlaMk2', 'Server', 'proto');
const OUTPUT_DIR = path.resolve(REPO_ROOT, 'assets', 'maps');

interface CliOptions {
  mapPath: string;
  protoRoot: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run tools:import-map -- <path-to-map | mapId>');
    process.exitCode = 1;
    throw new Error('No map path provided');
  }

  let mapArg = args[0];
  let protoRoot = DEFAULT_PROTO_DIR;
  let mapsRoot = DEFAULT_MAPS_DIR;

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--proto-root' && args[i + 1]) {
      protoRoot = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
    } else if (arg === '--maps-root' && args[i + 1]) {
      mapsRoot = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
    }
  }

  if (!mapArg.endsWith('.fomap')) {
    mapArg = `${mapArg}.fomap`;
  }

  let resolved = path.resolve(process.cwd(), mapArg);
  if (!resolved.startsWith(mapsRoot)) {
    const candidate = path.join(mapsRoot, mapArg);
    resolved = candidate;
  }

  return {
    mapPath: resolved,
    protoRoot,
  };
}

async function ensureOutputDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function main(): Promise<void> {
  let options: CliOptions;
  try {
    options = parseArgs();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[import-map] ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  try {
    await fs.access(options.mapPath);
  } catch {
    console.error(`[import-map] Map file not found: ${options.mapPath}`);
    process.exitCode = 1;
    return;
  }

  const resolver = new ProtoResolver(options.protoRoot);
  const mapData = await importFomap(options.mapPath, resolver);
  const mapId = mapData.id;

  const outputDir = OUTPUT_DIR;
  await ensureOutputDir(outputDir);
  const outputPath = path.join(outputDir, `${mapId}.json`);

  await fs.writeFile(outputPath, `${JSON.stringify(mapData, null, 2)}\n`, 'utf8');

  console.log(
    `[import-map] Saved ${mapId} → ${path.relative(process.cwd(), outputPath)} ` +
      `(tiles=${mapData.tiles.length}, objects=${mapData.objects.length}, spawns=${mapData.spawns.length})`,
  );
}

main().catch((error) => {
  console.error('[import-map] Unexpected error', error);
  process.exitCode = 1;
});
