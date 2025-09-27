import { describe, expect, it } from "vitest";
import {
  FALLOUT_GIMP_PALETTE,
  applyPalette,
  normalizePalette,
  parseBinaryPalette,
  parseFr,
  parseGimpPalette,
  parsePaletteFile,
} from "../src/fr-loader";

const FRAME_AREA_OFFSET = 0x3e;

function createTestFrBuffer(littleEndian = false): ArrayBuffer {
  const frameDataSize = 12 + 4; // frame header + pixels (2x2)
  const totalSize = FRAME_AREA_OFFSET + frameDataSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  view.setUint32(0, 4, littleEndian); // version
  view.setUint16(4, 10, littleEndian); // fps
  view.setUint16(6, 0, littleEndian); // action frame
  view.setUint16(8, 1, littleEndian); // frames per dir

  let offset = 0x0a;
  for (let i = 0; i < 6; i++) {
    view.setInt16(offset + i * 2, i, littleEndian); // shiftX
    view.setInt16(offset + 12 + i * 2, -i, littleEndian); // shiftY
  }

  offset = 0x22;
  view.setUint32(offset, 0, littleEndian); // dir 0 offset
  for (let i = 1; i < 6; i++) {
    view.setUint32(offset + i * 4, 0, littleEndian); // reuse previous direction
  }

  view.setUint32(0x3a, frameDataSize, littleEndian);

  const frameOffset = FRAME_AREA_OFFSET;
  view.setUint16(frameOffset, 2, littleEndian); // width
  view.setUint16(frameOffset + 2, 2, littleEndian); // height
  view.setUint32(frameOffset + 4, 4, littleEndian); // size
  view.setInt16(frameOffset + 8, 1, littleEndian); // xOff
  view.setInt16(frameOffset + 10, -1, littleEndian); // yOff

  const pixels = new Uint8Array(buffer, frameOffset + 12, 4);
  pixels.set([0, 1, 2, 3]);

  return buffer;
}

describe("parseFr", () => {
  it("декодирует заголовок и кадры", () => {
    const decoded = parseFr(createTestFrBuffer());

    expect(decoded.header.version).toBe(4);
    expect(decoded.header.fps).toBe(10);
    expect(decoded.header.framesPerDir).toBe(1);
    expect(decoded.header.shiftX).toEqual([0, 1, 2, 3, 4, 5]);
    expect(decoded.header.shiftY).toEqual([0, -1, -2, -3, -4, -5]);

    const frame = decoded.directions[0][0];
    expect(frame).toMatchObject({ w: 2, h: 2, xOff: 1, yOff: -1 });
    expect(Array.from(frame.pixelsIndex)).toEqual([0, 1, 2, 3]);

    const clone = decoded.directions[1][0];
    expect(clone).not.toBe(frame);
    expect(Array.from(clone.pixelsIndex)).toEqual([0, 1, 2, 3]);
  });

  it("автоопределяет little-endian файлы", () => {
    const decoded = parseFr(createTestFrBuffer(true));
    expect(decoded.header.version).toBe(4);
    expect(decoded.header.fps).toBe(10);
  });
});

describe("applyPalette", () => {
  it("накладывает палитру и возвращает RGBA кадры", () => {
    const decoded = parseFr(createTestFrBuffer());
    const palette = normalizePalette([
      [0, 0, 0],
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
    ]);

    const rgbaFrames = applyPalette(decoded, palette);
    const rgba = Array.from(rgbaFrames[0][0].rgba);

    expect(rgba).toEqual([
      0, 0, 0, 0,
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ]);
  });
});

describe("палитры", () => {
  it("парсит gpl палитру", () => {
    const palette = parseGimpPalette("GIMP Palette\n#\n10 20 30\n40 50 60");
    expect(Array.from(palette)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("парсит бинарную палитру", () => {
    const palette = parseBinaryPalette(new Uint8Array([1, 2, 3, 4, 5, 6]));
    expect(Array.from(palette)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("понимает gpl через parsePaletteFile", () => {
    const encoder = new TextEncoder();
    const palette = parsePaletteFile(encoder.encode("GIMP Palette\n#\n1 2 3").buffer, "demo.gpl");
    expect(Array.from(palette)).toEqual([1, 2, 3]);
  });

  it("содержит дефолтную палитру Fallout", () => {
    expect(FALLOUT_GIMP_PALETTE.length % 3).toBe(0);
    expect(FALLOUT_GIMP_PALETTE.length).toBeGreaterThanOrEqual(768);
  });
});
