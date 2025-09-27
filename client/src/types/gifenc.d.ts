declare module "gifenc" {
  export interface GIFEncoderOptions {
    auto?: boolean;
    initialCapacity?: number;
  }

  export interface WriteFrameOptions {
    palette?: number[][];
    delay?: number;
    transparent?: boolean;
    transparentIndex?: number;
    repeat?: number;
    dispose?: number;
    first?: boolean;
  }

  export interface GIFEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(options?: GIFEncoderOptions): GIFEncoderInstance;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: Record<string, unknown>,
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;
  export function nearestColor(palette: number[][], pixel: number[]): number[];
  export function nearestColorIndex(palette: number[][], pixel: number[]): number;
  export function nearestColorIndexWithDistance(palette: number[][], pixel: number[]): [number, number];
  export function prequantize(
    pixels: Array<Uint8Array | Uint8ClampedArray>,
    options?: Record<string, unknown>,
  ): number[][][];
  export function snapColorsToPalette(palette: number[][], snap: number[][]): number[][];

  const _default: {
    GIFEncoder: typeof GIFEncoder;
    quantize: typeof quantize;
    applyPalette: typeof applyPalette;
    nearestColor: typeof nearestColor;
    nearestColorIndex: typeof nearestColorIndex;
    nearestColorIndexWithDistance: typeof nearestColorIndexWithDistance;
    prequantize: typeof prequantize;
    snapColorsToPalette: typeof snapColorsToPalette;
  };

  export default _default;
}
