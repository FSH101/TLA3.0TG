import { describe, it, expect } from 'vitest';
import {
  convertHexIndexToScreenCoords,
  convertScreenCoordsToHexIndex,
  findAdjacentHexes,
  findOrientation,
  heuristicDistance,
  MAP_HEX_WIDTH,
} from './geometry.js';

describe('geometry helpers', () => {
  it('projects hex indexes to screen coordinates using jsFO math', () => {
    expect(convertHexIndexToScreenCoords(0)).toEqual({ x: 0, y: 0 });
    expect(convertHexIndexToScreenCoords(1)).toEqual({ x: -32, y: 0 });
    expect(convertHexIndexToScreenCoords(MAP_HEX_WIDTH)).toEqual({ x: 16, y: 12 });
  });

  it('round-trips screen coordinates back to hex indexes', () => {
    const index = MAP_HEX_WIDTH + 5;
    const coords = convertHexIndexToScreenCoords(index);
    expect(convertScreenCoordsToHexIndex(coords.x, coords.y)).toBe(index);
  });

  it('matches jsFO adjacency ordering for odd and even columns', () => {
    expect(findAdjacentHexes(1)).toEqual([-200, 0, 201, 2, -198, -199]);
    expect(findAdjacentHexes(2)).toEqual([1, 201, 202, 203, 3, -198]);
  });

  it('computes orientation index compatible with jsFO', () => {
    expect(findOrientation(1, 0)).toBe(1);
    expect(findOrientation(2, 203)).toBe(3);
  });

  it('estimates distance using screen-space heuristic', () => {
    const dist = heuristicDistance(0, MAP_HEX_WIDTH + 1);
    expect(dist).toBeCloseTo(Math.hypot(16, 12));
  });
});
