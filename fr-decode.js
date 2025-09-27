#!/usr/bin/env node
/* eslint-disable no-console */
const { existsSync, mkdirSync, promises: fs } = require("fs");
const { basename, extname, join, resolve } = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");
const { PNG } = require("pngjs");

const args = process.argv.slice(2);

if (args.length < 2 || args.length > 3) {
  console.error("Использование: node fr-decode.js <file.frm> [palette.pal] <output_dir>");
  process.exit(1);
}

const [frmPath, maybePalette, maybeOut] = args;
const palettePath = args.length === 3 ? maybePalette : null;
const outDir = resolve(args.length === 3 ? maybeOut : maybePalette);
const frmFile = resolve(frmPath);

(async () => {
  const shared = await loadSharedModule();
  const { applyPalette, parseFr, parsePaletteFile, FALLOUT_GIMP_PALETTE, normalizePalette } = shared;

  const frmBuffer = await fs.readFile(frmFile);
  const decoded = parseFr(toArrayBuffer(frmBuffer));

  let paletteBytes = FALLOUT_GIMP_PALETTE;
  if (palettePath) {
    const paletteBuffer = await fs.readFile(resolve(palettePath));
    paletteBytes = parsePaletteFile(toArrayBuffer(paletteBuffer), palettePath);
  }

  const rgba = applyPalette(decoded, normalizePalette(paletteBytes));

  mkdirSync(outDir, { recursive: true });

  const base = basename(frmFile, extname(frmFile));
  const metadata = { header: decoded.header, directions: [] };

  for (let dir = 0; dir < rgba.length; dir++) {
    const frames = rgba[dir];
    metadata.directions.push(
      frames.map((frame, index) => ({
        frame: index,
        width: frame.w,
        height: frame.h,
        xOff: frame.xOff,
        yOff: frame.yOff,
        file: `${base}_dir${dir}_frame${index}.png`,
      })),
    );

    for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
      const frame = frames[frameIndex];
      const pngBuffer = PNG.sync.write({
        width: frame.w,
        height: frame.h,
        data: Buffer.from(frame.rgba),
        colorType: 6,
      });
      const filePath = join(outDir, `${base}_dir${dir}_frame${frameIndex}.png`);
      await fs.writeFile(filePath, pngBuffer);
    }
  }

  await fs.writeFile(join(outDir, `${base}.json`), JSON.stringify(metadata, null, 2), "utf8");

  console.log(`Готово: сохранено ${rgba.flat().length} кадров в ${outDir}`);
})();

async function loadSharedModule() {
  const sharedPath = resolve(__dirname, "shared/dist/index.js");
  if (!existsSync(sharedPath)) {
    console.log("Сборка пакета @tla/shared...");
    const result = spawnSync("npm", ["run", "build", "--workspace", "shared"], { stdio: "inherit" });
    if (result.status !== 0) {
      console.error("Не удалось собрать пакет @tla/shared");
      process.exit(result.status ?? 1);
    }
  }
  return import(pathToFileURL(sharedPath).href);
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
