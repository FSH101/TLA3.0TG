export type Hex = { q: number; r: number };

export const HEX_DIRS: Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const HEX_TILE_WIDTH = 128;
export const HEX_TILE_HEIGHT = 64;

const halfWidth = HEX_TILE_WIDTH / 2;
const halfHeight = HEX_TILE_HEIGHT / 2;

type Cube = { x: number; y: number; z: number };

function axialToCube(hex: Hex): Cube {
  const x = hex.q;
  const z = hex.r;
  const y = -x - z;
  return { x, y, z };
}

function cubeToAxial(cube: Cube): Hex {
  const q = cube.x === 0 ? 0 : cube.x;
  const r = cube.z === 0 ? 0 : cube.z;
  return { q, r };
}

function cubeRound(cube: Cube): Cube {
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);

  const xDiff = Math.abs(rx - cube.x);
  const yDiff = Math.abs(ry - cube.y);
  const zDiff = Math.abs(rz - cube.z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: rx, y: ry, z: rz };
}

export function hexToWorld(hex: Hex): { x: number; y: number } {
  const x = (hex.q - hex.r) * halfWidth;
  const y = (hex.q + hex.r) * halfHeight;
  return { x, y };
}

export function worldToHex(x: number, y: number): Hex {
  const q = 0.5 * (x / halfWidth + y / halfHeight);
  const r = 0.5 * (y / halfHeight - x / halfWidth);
  const cube = cubeRound({ x: q, y: -q - r, z: r });
  return cubeToAxial(cube);
}

export function hexDistance(a: Hex, b: Hex): number {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
}
