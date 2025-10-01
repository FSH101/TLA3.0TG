export interface HexScreenPoint {
  x: number;
  y: number;
}

export interface GeometryOptions {
  width?: number;
  tileColumns?: number;
}

export const MAP_TILE_COLUMNS = 100;
export const MAP_HEX_WIDTH = 200;
export const MAP_ROOF_HEIGHT = 96;
export const MAP_ALIGNMENT_OFFSET = { x: 48, y: -3 } as const;

function resolveWidth(width?: number): number {
  return typeof width === 'number' && Number.isFinite(width) && width > 0 ? Math.trunc(width) : MAP_HEX_WIDTH;
}

function resolveTileColumns(columns?: number): number {
  return typeof columns === 'number' && Number.isFinite(columns) && columns > 0
    ? Math.trunc(columns)
    : MAP_TILE_COLUMNS;
}

export function convertHexIndexToScreenCoords(index: number, options: GeometryOptions = {}): HexScreenPoint {
  const width = resolveWidth(options.width);
  const q = index % width;
  const r = Math.floor(index / width);
  const px = 0 - q * 32 + r * 16;
  const py = r * 12;
  const qx = Math.floor(q / 2) * 16;
  const qy = Math.floor(q / 2) * 12;
  return { x: px + qx, y: py + qy };
}

export function convertTileIndexToScreenCoords(index: number, options: GeometryOptions = {}): HexScreenPoint {
  const columns = resolveTileColumns(options.tileColumns);
  const tCol = index % columns;
  const tRow = Math.floor(index / columns);
  return {
    x: 0 - MAP_ALIGNMENT_OFFSET.x - tCol * 48 + tRow * 32,
    y: MAP_ALIGNMENT_OFFSET.y + tCol * 12 + tRow * 24,
  };
}

export function convertScreenCoordsToHexIndex(mx: number, my: number, options: GeometryOptions = {}): number {
  const width = resolveWidth(options.width);
  let adjustedX = mx;
  if (adjustedX < 0) {
    adjustedX -= 32;
  }
  adjustedX *= -1;
  let hCol = Math.floor(adjustedX / 32);
  let hRow = Math.floor(my / 12);
  if (hRow > 0) {
    hCol += Math.floor(Math.abs(hRow) / 2);
  }
  hRow -= Math.floor(hCol / 2);
  return hRow * width + hCol;
}

export function findAdjacentHexes(index: number, options: GeometryOptions = {}): number[] {
  const width = resolveWidth(options.width);
  const column = index % width;
  const isOddColumn = column % 2 !== 0;
  const northWest = isOddColumn ? index - (width + 1) : index - 1;
  const northEast = isOddColumn ? index - 1 : index + (width - 1);
  const south = index + width;
  const southEast = isOddColumn ? index + 1 : index + (width + 1);
  const southWest = isOddColumn ? index - (width - 1) : index + 1;
  const north = index - width;
  return [northWest, northEast, south, southEast, southWest, north];
}

export function findOrientation(origin: number, dest: number, options: GeometryOptions = {}): number {
  if (origin === dest) {
    throw new Error('Origin and destination hexes are identical');
  }
  const neighbors = findAdjacentHexes(origin, options);
  const orientation = neighbors.indexOf(dest);
  if (orientation === -1) {
    throw new Error('Destination hex is not adjacent to origin');
  }
  return orientation;
}

export function heuristicDistance(a: number, b: number, options: GeometryOptions = {}): number {
  const start = convertHexIndexToScreenCoords(a, options);
  const end = convertHexIndexToScreenCoords(b, options);
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return Math.sqrt(dx * dx + dy * dy);
}

export function toHexIndex(q: number, r: number, options: GeometryOptions = {}): number {
  const width = resolveWidth(options.width);
  return r * width + q;
}

export function fromHexIndex(index: number, options: GeometryOptions = {}): { q: number; r: number } {
  const width = resolveWidth(options.width);
  const q = index % width;
  const r = Math.floor(index / width);
  return { q, r };
}

export function intersectTest(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return !(bx > ax + aw || bx + bw < ax || by > ay + ah || by + bh < ay);
}
