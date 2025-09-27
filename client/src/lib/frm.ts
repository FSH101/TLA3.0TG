export interface FrmJsonFrame {
  offsetX: number;
  offsetY: number;
  pixels: string;
}

export interface FrmJsonDocument {
  schema: "pipboy-frm-v1";
  width: number;
  height: number;
  fps: number;
  palette: Array<[number, number, number, number]>;
  frames: FrmJsonFrame[];
}

export interface FrmFrame {
  image: ImageData;
  offsetX: number;
  offsetY: number;
}

export interface FrmAnimation {
  width: number;
  height: number;
  fps: number;
  frames: FrmFrame[];
}

function decodeBase64Pixels(base64: string, expectedSize: number): Uint8Array {
  const binary = atob(base64);
  if (binary.length !== expectedSize) {
    throw new Error(
      `Размер данных кадра (${binary.length}) не совпадает с ожидаемым (${expectedSize})`,
    );
  }
  const buffer = new Uint8Array(expectedSize);
  for (let i = 0; i < expectedSize; i += 1) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function paletteToUint32(palette: Array<[number, number, number, number]>): Uint32Array {
  const view = new Uint32Array(palette.length);
  const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  palette.forEach(([r, g, b, a], index) => {
    const clamped = [r, g, b, a].map((value) => Math.max(0, Math.min(255, value)));
    const [cr, cg, cb, ca] = clamped;
    const value = littleEndian
      ? (ca << 24) | (cb << 16) | (cg << 8) | cr
      : (cr << 24) | (cg << 16) | (cb << 8) | ca;
    view[index] = value >>> 0;
  });
  return view;
}

function frameToImageData(
  indices: Uint8Array,
  palette: Uint32Array,
  width: number,
  height: number,
): ImageData {
  const image = new ImageData(width, height);
  const rgba = new Uint32Array(image.data.buffer);
  for (let i = 0; i < indices.length; i += 1) {
    const paletteIndex = indices[i];
    rgba[i] = palette[paletteIndex] ?? 0;
  }
  return image;
}

export function parseFrmJson(source: string): FrmAnimation {
  let parsed: FrmJsonDocument;
  try {
    parsed = JSON.parse(source) as FrmJsonDocument;
  } catch (error) {
    throw new Error("Не удалось разобрать FRM-документ как JSON");
  }
  if (parsed.schema !== "pipboy-frm-v1") {
    throw new Error("Неподдерживаемая схема FRM-документа");
  }
  const { width, height, fps, palette, frames } = parsed;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Некорректные размеры кадра FRM");
  }
  const paletteView = paletteToUint32(palette);
  const expectedSize = width * height;
  const decodedFrames = frames.map((frame) => {
    const pixels = decodeBase64Pixels(frame.pixels, expectedSize);
    return {
      offsetX: frame.offsetX ?? 0,
      offsetY: frame.offsetY ?? 0,
      image: frameToImageData(pixels, paletteView, width, height),
    } satisfies FrmFrame;
  });
  if (decodedFrames.length === 0) {
    throw new Error("FRM-анимация не содержит кадров");
  }
  return {
    width,
    height,
    fps,
    frames: decodedFrames,
  };
}

export function playFrmAnimation(
  canvas: HTMLCanvasElement,
  animation: FrmAnimation,
): () => void {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D контекст недоступен");
  }
  canvas.width = animation.width;
  canvas.height = animation.height;
  let frameIndex = 0;
  let raf = 0;
  const frameDuration = 1000 / Math.max(1, animation.fps ?? 10);
  let accumulator = 0;
  let previousTimestamp = performance.now();

  const renderFrame = (timestamp: number) => {
    const delta = timestamp - previousTimestamp;
    previousTimestamp = timestamp;
    accumulator += delta;
    while (accumulator >= frameDuration) {
      accumulator -= frameDuration;
      frameIndex = (frameIndex + 1) % animation.frames.length;
    }
    const frame = animation.frames[frameIndex];
    context.putImageData(frame.image, frame.offsetX ?? 0, frame.offsetY ?? 0);
    raf = requestAnimationFrame(renderFrame);
  };

  context.putImageData(animation.frames[0].image, animation.frames[0].offsetX ?? 0, animation.frames[0].offsetY ?? 0);
  raf = requestAnimationFrame(renderFrame);

  return () => {
    if (raf) {
      cancelAnimationFrame(raf);
    }
  };
}
