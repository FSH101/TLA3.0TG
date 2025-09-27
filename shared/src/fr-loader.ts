/* eslint-disable @typescript-eslint/no-loss-of-precision */
export interface FrHeader {
  version: number;
  fps: number;
  actionFrame: number;
  framesPerDir: number;
  shiftX: number[];
  shiftY: number[];
  dirOffsets: number[];
}

export interface FrFrame {
  w: number;
  h: number;
  xOff: number;
  yOff: number;
  pixelsIndex: Uint8Array;
}

export interface FrDecoded {
  header: FrHeader;
  directions: FrFrame[][];
}

export interface RgbaFrame {
  w: number;
  h: number;
  xOff: number;
  yOff: number;
  rgba: Uint8ClampedArray;
}


interface FrameHeaderData {
  w: number;
  h: number;
  size: number;
  xOff: number;
  yOff: number;
}
export type PaletteInput = Uint8Array | number[][];

const DIRECTIONS = 6;
const FRAME_AREA_OFFSET = 0x3e;

export function parseFr(buffer: ArrayBuffer): FrDecoded {
  if (buffer.byteLength < FRAME_AREA_OFFSET) {
    throw new Error("FR файл поврежден: размер меньше заголовка");
  }

  const view = new DataView(buffer);
  const { header, frameAreaSize, littleEndian } = readHeaderWithFallback(view, buffer.byteLength);

  const frameAreaStart = FRAME_AREA_OFFSET;
  const frameAreaEnd = frameAreaStart + frameAreaSize;
  if (frameAreaEnd > buffer.byteLength) {
    throw new Error("FR файл поврежден: область кадров выходит за пределы файла");
  }

  const directions: FrFrame[][] = [];

  for (let dir = 0; dir < DIRECTIONS; dir++) {
    const dirOffset = header.dirOffsets[dir];

    if (dirOffset === 0 && dir > 0) {
      // Некоторые файлы Fallout используют зеркальные направления без данных.
      directions.push(cloneFrames(directions[dir - 1] ?? []));
      continue;
    }

    const frames: FrFrame[] = [];
    let cursor = frameAreaStart + dirOffset;
    let frameEndian = littleEndian;

    for (let frameIndex = 0; frameIndex < header.framesPerDir; frameIndex++) {
      if (cursor + 12 > buffer.byteLength) {
        throw new Error("FR файл поврежден: неполные данные кадра");
      }

      const { frame, littleEndianUsed } = readFrameHeaderWithFallback(view, cursor, frameEndian, frameAreaEnd);
      frameEndian = littleEndianUsed;
      const { w, h, size, xOff, yOff } = frame;
      cursor += 12;

      if (cursor + size > buffer.byteLength || cursor + size > frameAreaEnd) {
        throw new Error("FR файл поврежден: недостаточно байт индексации палитры");
      }

      const pixelsSlice = new Uint8Array(buffer, cursor, size);
      const pixelsIndex = new Uint8Array(size);
      pixelsIndex.set(pixelsSlice);
      cursor += size;

      frames.push({ w, h, xOff, yOff, pixelsIndex });
    }

    directions.push(frames);
  }

  return { header, directions };
}

export function applyPalette(decoded: FrDecoded, paletteInput: PaletteInput): RgbaFrame[][] {
  const palette = normalizePalette(paletteInput);

  return decoded.directions.map((frames) =>
    frames.map((frame) => {
      const { w, h, xOff, yOff, pixelsIndex } = frame;
      const rgba = new Uint8ClampedArray(w * h * 4);

      for (let i = 0; i < pixelsIndex.length; i++) {
        const index = pixelsIndex[i];
        const target = i * 4;
        if (index === 0) {
          rgba[target + 3] = 0;
          continue;
        }
        const paletteIndex = index * 3;
        if (paletteIndex + 2 >= palette.length) {
          throw new Error(`Индекс палитры ${index} выходит за пределы ${palette.length / 3} цветов`);
        }
        rgba[target] = palette[paletteIndex];
        rgba[target + 1] = palette[paletteIndex + 1];
        rgba[target + 2] = palette[paletteIndex + 2];
        rgba[target + 3] = 255;
      }

      return { w, h, xOff, yOff, rgba };
    }),
  );
}

export function normalizePalette(paletteInput: PaletteInput): Uint8Array {
  if (paletteInput instanceof Uint8Array || paletteInput instanceof Uint8ClampedArray) {
    if (paletteInput.length % 3 !== 0) {
      throw new Error("Палитра должна содержать кратное 3 количество байт");
    }
    return new Uint8Array(paletteInput);
  }

  if (!Array.isArray(paletteInput)) {
    throw new Error("Неподдерживаемый формат палитры");
  }

  const flat = new Uint8Array(paletteInput.length * 3);
  paletteInput.forEach((color, index) => {
    if (!Array.isArray(color) || color.length < 3) {
      throw new Error(`Цвет палитры #${index} должен содержать минимум 3 компоненты`);
    }
    const base = index * 3;
    flat[base] = clampColorComponent(color[0]);
    flat[base + 1] = clampColorComponent(color[1]);
    flat[base + 2] = clampColorComponent(color[2]);
  });
  return flat;
}

function clampColorComponent(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Компоненты палитры должны быть конечными числами");
  }
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}

function cloneFrames(frames: FrFrame[]): FrFrame[] {
  return frames.map((frame) => ({
    w: frame.w,
    h: frame.h,
    xOff: frame.xOff,
    yOff: frame.yOff,
    pixelsIndex: new Uint8Array(frame.pixelsIndex),
  }));
}

function readHeaderWithFallback(view: DataView, bufferLength: number): {
  header: FrHeader;
  frameAreaSize: number;
  littleEndian: boolean;
} {
  const be = readHeaderRaw(view, false);
  if (isHeaderPlausible(be.header, be.frameAreaSize, bufferLength)) {
    return { ...be, littleEndian: false };
  }
  const le = readHeaderRaw(view, true);
  if (isHeaderPlausible(le.header, le.frameAreaSize, bufferLength)) {
    return { ...le, littleEndian: true };
  }
  throw new Error("FR файл поврежден: заголовок нераспознан");
}

function readHeaderRaw(view: DataView, littleEndian: boolean): {
  header: FrHeader;
  frameAreaSize: number;
} {
  let offset = 0;
  const version = view.getUint32(offset, littleEndian);
  offset += 4;
  const fps = view.getUint16(offset, littleEndian);
  offset += 2;
  const actionFrame = view.getUint16(offset, littleEndian);
  offset += 2;
  const framesPerDir = view.getUint16(offset, littleEndian);
  offset += 2;

  const shiftX: number[] = [];
  for (let i = 0; i < DIRECTIONS; i++, offset += 2) {
    shiftX.push(view.getInt16(offset, littleEndian));
  }

  const shiftY: number[] = [];
  for (let i = 0; i < DIRECTIONS; i++, offset += 2) {
    shiftY.push(view.getInt16(offset, littleEndian));
  }

  const dirOffsets: number[] = [];
  for (let i = 0; i < DIRECTIONS; i++, offset += 4) {
    dirOffsets.push(view.getUint32(offset, littleEndian));
  }

  const frameAreaSize = view.getUint32(offset, littleEndian);
  offset += 4;

  return {
    header: {
      version,
      fps,
      actionFrame,
      framesPerDir,
      shiftX,
      shiftY,
      dirOffsets,
    },
    frameAreaSize,
  };
}

function isHeaderPlausible(header: FrHeader, frameAreaSize: number, bufferLength: number): boolean {
  if (header.version <= 0 || header.version > 0xffff) {
    return false;
  }
  if (header.fps < 0 || header.fps > 1000) {
    return false;
  }
  if (header.framesPerDir <= 0 || header.framesPerDir > 400) {
    return false;
  }
  if (frameAreaSize <= 0 || frameAreaSize > bufferLength - FRAME_AREA_OFFSET) {
    return false;
  }
  return header.dirOffsets.every((offset) => offset === 0 || offset < frameAreaSize);
}

function readFrameHeaderWithFallback(
  view: DataView,
  cursor: number,
  preferredLittleEndian: boolean,
  frameAreaEnd: number,
): {
  frame: FrameHeaderData;
  littleEndianUsed: boolean;
} {
  const candidate = readFrameHeaderRaw(view, cursor, preferredLittleEndian);
  if (isFramePlausible(candidate, cursor, frameAreaEnd)) {
    return { frame: candidate, littleEndianUsed: preferredLittleEndian };
  }
  const fallback = readFrameHeaderRaw(view, cursor, !preferredLittleEndian);
  if (isFramePlausible(fallback, cursor, frameAreaEnd)) {
    return { frame: fallback, littleEndianUsed: !preferredLittleEndian };
  }
  throw new Error("FR файл поврежден: некорректные размеры кадра");
}

function readFrameHeaderRaw(view: DataView, cursor: number, littleEndian: boolean): FrameHeaderData {
  return {
    w: view.getUint16(cursor, littleEndian),
    h: view.getUint16(cursor + 2, littleEndian),
    size: view.getUint32(cursor + 4, littleEndian),
    xOff: view.getInt16(cursor + 8, littleEndian),
    yOff: view.getInt16(cursor + 10, littleEndian),
  };
}

function isFramePlausible(frame: FrameHeaderData, cursor: number, frameAreaEnd: number): boolean {
  if (frame.w <= 0 || frame.h <= 0) {
    return false;
  }
  if (frame.w > 4096 || frame.h > 4096) {
    return false;
  }
  if (frame.size <= 0 || frame.size !== frame.w * frame.h) {
    return false;
  }
  const remaining = frameAreaEnd - cursor - 12;
  if (remaining < frame.size) {
    return false;
  }
  return true;
}

export function parseGimpPalette(text: string): Uint8Array {
  const colors: number[] = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || /^[A-Za-z]/.test(line)) {
      continue;
    }
    const parts = rawLine
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => Number.parseInt(part, 10))
      .filter((value) => Number.isFinite(value));
    if (parts.length >= 3) {
      colors.push(parts[0], parts[1], parts[2]);
    }
  }
  if (colors.length === 0) {
    throw new Error("Не удалось распарсить GIMP палитру");
  }
  return new Uint8Array(colors);
}

export function parseBinaryPalette(buffer: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length === 0) {
    throw new Error("Пустая палитра");
  }
  if (bytes.length === 772) {
    return new Uint8Array(bytes.slice(0, 768));
  }
  if (bytes.length % 3 !== 0) {
    throw new Error("Бинарная палитра должна иметь длину кратную 3");
  }
  return new Uint8Array(bytes);
}

export function parsePaletteFile(data: ArrayBuffer, name?: string): Uint8Array {
  if (name?.toLowerCase().endsWith(".gpl")) {
    const decoder = new TextDecoder();
    return parseGimpPalette(decoder.decode(data));
  }
  return parseBinaryPalette(data);
}

const FALLOUT_GIMP_TEXT = `GIMP Palette\nName: !Fallout\nColumns: 16\n#\n 0 0 255\n236 236 236\n220 220 220\n204 204 204\n188 188 188\n176 176 176\n160 160 160\n144 144 144\n128 128 128\n116 116 116\n100 100 100\n 84 84 84\n 72 72 72\n 56 56 56\n 40 40 40\n 32 32 32\n252 236 236\n236 216 216\n220 196 196\n208 176 176\n192 160 160\n176 144 144\n164 128 128\n148 112 112\n132 96 96\n120 84 84\n104 68 68\n 88 56 56\n 76 44 44\n 60 36 36\n 44 24 24\n 32 16 16\n236 236 252\n216 216 236\n196 196 220\n176 176 208\n160 160 192\n144 144 176\n128 128 164\n112 112 148\n 96 96 132\n 84 84 120\n 68 68 104\n 56 56 88\n 44 44 76\n 36 36 60\n 24 24 44\n 16 16 32\n252 176 240\n196 96 168\n104 36 96\n 76 20 72\n 56 12 52\n 40 16 36\n 36 4 36\n 28 12 24\n252 252 200\n252 252 124\n228 216 12\n204 184 28\n184 156 40\n164 136 48\n144 120 36\n124 104 24\n108 88 16\n 88 72 8\n 72 56 4\n 52 40 0\n 32 24 0\n216 252 156\n180 216 132\n152 184 112\n120 152 92\n 92 120 72\n 64 88 52\n 40 56 32\n112 96 80\n 84 72 52\n 56 48 32\n104 120 80\n112 120 32\n112 104 40\n 96 96 36\n 76 68 36\n 56 48 32\n156 172 156\n120 148 120\n 88 124 88\n 64 104 64\n 56 88 88\n 48 76 72\n 40 68 60\n 32 60 44\n 28 48 36\n 20 40 24\n 16 32 16\n 24 48 24\n 16 36 12\n 8 28 4\n 4 20 0\n 4 12 0\n140 156 156\n120 148 152\n100 136 148\n 80 124 144\n 64 108 140\n 48 88 140\n 44 76 124\n 40 68 108\n 32 56 92\n 28 48 76\n 24 40 64\n156 164 164\n 56 72 104\n 80 88 88\n 88 104 132\n 56 64 80\n188 188 188\n172 164 152\n160 144 124\n148 124 96\n136 104 76\n124 88 52\n112 72 36\n100 60 20\n 88 48 8\n252 204 204\n252 176 176\n252 152 152\n252 124 124\n252 100 100\n252 72 72\n252 48 48\n252 0 0\n224 0 0\n196 0 0\n168 0 0\n144 0 0\n116 0 0\n 88 0 0\n 64 0 0\n252 224 200\n252 196 148\n252 184 120\n252 172 96\n252 156 72\n252 148 44\n252 136 20\n252 124 0\n220 108 0\n192 96 0\n164 80 0\n132 68 0\n104 52 0\n 76 36 0\n 48 24 0\n248 212 164\n216 176 120\n200 160 100\n188 144 84\n172 128 68\n156 116 52\n140 100 40\n124 88 28\n112 76 20\n 96 64 8\n 80 52 4\n 64 40 0\n 52 32 0\n252 228 184\n232 200 152\n212 172 124\n196 144 100\n176 116 76\n160 92 56\n144 76 44\n132 60 32\n120 44 24\n108 32 16\n 92 20 8\n 72 12 4\n 60 4 0\n252 232 220\n248 212 188\n244 192 160\n240 176 132\n240 160 108\n240 148 92\n216 128 84\n192 112 72\n168 96 64\n144 80 56\n120 64 48\n 96 48 36\n 72 36 28\n 56 24 20\n100 228 100\n 20 152 20\n 0 164 0\n 80 80 72\n 0 108 0\n140 140 132\n 28 28 28\n104 80 56\n 48 40 32\n140 112 96\n 72 56 40\n 12 12 12\n 60 60 60\n108 116 108\n120 132 120\n136 148 136\n148 164 148\n 88 104 96\n 96 112 104\n 60 248 0\n 56 212 8\n 52 180 16\n 48 148 20\n 40 116 24\n252 252 252\n240 236 208\n208 184 136\n152 124 80\n104 88 60\n 80 64 36\n 52 40 28\n 24 16 12\n 0 0 0\n 0 108 0\n 11 115 7\n 27 123 15\n 43 131 27\n107 107 111\n 99 103 127\n 87 107 143\n 0 147 163\n107 187 255\n255 0 0\n215 0 0\n147 43 11\n255 119 0\n255 59 0\n 71 0 0\n123 0 0\n179 0 0\n123 0 0\n 71 0 0\n 83 63 43\n 75 59 43\n 67 55 39\n 63 51 39\n 55 47 35\n 51 43 35\n252 0 0\n255 255 255\n`;

export const FALLOUT_GIMP_PALETTE = parseGimpPalette(FALLOUT_GIMP_TEXT);
