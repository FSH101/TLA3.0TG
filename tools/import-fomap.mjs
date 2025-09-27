#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
      args[key] = value;
      if (value !== "true") i += 1;
    }
  }
  return args;
}

function sanitizeId(raw) {
  return raw
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\.frm$/i, "")
    ?.replace(/[^a-zA-Z0-9_\-]+/g, "_")
    ?.toLowerCase() ?? "tile_placeholder";
}

function offsetToAxial(x, y) {
  const col = Math.round(x / 2);
  const row = Math.round(y / 2);
  const q = col - Math.floor(row / 2);
  const r = row;
  return { q, r };
}

function determineLayerFromPath(path) {
  const lowered = path.toLowerCase();
  if (lowered.includes("wall")) return "wall";
  if (lowered.includes("scen") || lowered.includes("misc")) return "object";
  return "floor";
}

function determineLayerFromObject(obj) {
  const type = Number(obj.MapObjType ?? obj.Type ?? 0);
  if (type === 3) return "wall";
  if (type === 4) return "floor";
  return "object";
}

function parseFomap(content) {
  const lines = content.split(/\r?\n/);
  const tiles = [];
  const objects = [];
  let section = "";
  let currentObject = null;

  const flushObject = () => {
    if (currentObject && currentObject.MapX !== undefined && currentObject.MapY !== undefined) {
      objects.push({ ...currentObject });
    }
    currentObject = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (section === "Objects") {
        flushObject();
      }
      continue;
    }

    if (line.startsWith("[")) {
      if (section === "Objects") {
        flushObject();
      }
      section = line.slice(1, -1);
      continue;
    }

    if (section === "Tiles" && line.startsWith("tile")) {
      const match = line.match(/^tile\s+(\d+)\s+(\d+)\s+(.+)$/i);
      if (!match) continue;
      const [, xStr, yStr, path] = match;
      tiles.push({
        x: Number(xStr),
        y: Number(yStr),
        path: path.trim(),
      });
      continue;
    }

    if (section === "Objects") {
      const [key, ...rest] = line.split(/\s+/);
      if (!currentObject) currentObject = {};
      currentObject[key] = rest.join(" ");
    }
  }

  if (section === "Objects") {
    flushObject();
  }

  return { tiles, objects };
}

function convert({ tiles, objects }, options) {
  const entries = [];
  const objectEntries = [];

  for (const tile of tiles) {
    const { q, r } = offsetToAxial(tile.x, tile.y);
    entries.push({ q, r, id: sanitizeId(tile.path), layer: determineLayerFromPath(tile.path) });
  }

  for (const obj of objects) {
    const x = Number(obj.MapX ?? obj.HexX ?? obj.X ?? 0);
    const y = Number(obj.MapY ?? obj.HexY ?? obj.Y ?? 0);
    const { q, r } = offsetToAxial(x, y);
    const layer = determineLayerFromObject(obj);
    const id = obj.ProtoId ? `proto_${obj.ProtoId}` : sanitizeId(String(obj.Pid ?? "object"));
    const entry = { q, r, id, layer };
    if (obj.Scenery_ToMapPid) {
      entry.link = obj.Scenery_ToMapPid;
    }
    if (obj.Scenery_BlockLines === "1" || obj.ScBlockLines === "1") {
      entry.block = true;
    }
    objectEntries.push(entry);
  }

  const minQ = Math.min(...entries.map((t) => t.q), ...objectEntries.map((t) => t.q));
  const minR = Math.min(...entries.map((t) => t.r), ...objectEntries.map((t) => t.r));

  const normalized = entries.map((tile) => ({
    ...tile,
    q: tile.q - minQ,
    r: tile.r - minR,
  }));

  const normalizedObjects = objectEntries.map((obj) => ({
    ...obj,
    q: obj.q - minQ,
    r: obj.r - minR,
  }));

  const size = Number(options.size ?? 64);
  const filteredTiles = normalized.filter((tile) => tile.q >= 0 && tile.q < size && tile.r >= 0 && tile.r < size);
  const filteredObjects = normalizedObjects.filter(
    (obj) => obj.q >= 0 && obj.q < size && obj.r >= 0 && obj.r < size,
  );

  const deduped = new Map();

  const coerceLayer = (layer) => (layer === "floor" ? "floor" : layer === "wall" ? "wall" : "object");

  for (const tile of filteredTiles) {
    const entry = {
      layer: coerceLayer(tile.layer),
      q: tile.q,
      r: tile.r,
      id: tile.id,
    };
    deduped.set(`${entry.layer}:${entry.q}:${entry.r}`, entry);
  }

  for (const obj of filteredObjects) {
    const entry = {
      layer: coerceLayer(obj.layer),
      q: obj.q,
      r: obj.r,
      id: obj.id,
      ...(obj.block ? { block: true } : {}),
      ...(obj.link ? { meta: { toMap: obj.link } } : {}),
    };
    deduped.set(`${entry.layer}:${entry.q}:${entry.r}`, entry);
  }

  return {
    tiles: Array.from(deduped.values()),
    bounds: { width: size, height: size },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.error("Укажите --input путь к .fomap файлу");
    process.exit(1);
  }
  const content = await readFile(args.input, "utf8");
  const parsed = parseFomap(content);
  const converted = convert(parsed, args);

  const id = args.id ?? basename(args.input).replace(/\.fomap$/i, "");
  const map = {
    id,
    size: converted.bounds,
    tiles: converted.tiles,
    spawns: {
      player: [
        { q: Math.floor(converted.bounds.width / 2), r: Math.floor(converted.bounds.height / 2) },
      ],
    },
    source: {
      type: "fomap",
      file: basename(args.input),
    },
  };

  const outputPath = args.output ?? `${id}.json`;
  await writeFile(outputPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  console.log(`Карта сохранена в ${outputPath}`);
}

await main();
