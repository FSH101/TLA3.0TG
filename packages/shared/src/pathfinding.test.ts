import { describe, it, expect } from 'vitest';
import { findAdjacentHexes } from './geometry.js';
import { findPath } from './pathfinding.js';

describe('findPath', () => {
  const width = 6;
  const height = 6;

  it('returns empty path when start equals destination', () => {
    expect(findPath(5, 5, { width, height })).toEqual([]);
  });

  it('finds a viable route around blocked tiles', () => {
    const blocked = new Set([1, 7, 13, 14]);
    const start = 0;
    const dest = width * 2 + 3;
    const path = findPath(start, dest, {
      width,
      height,
      isBlocked: (index) => blocked.has(index),
    });
    expect(path).not.toBeNull();
    const steps = path!;
    expect(steps.at(-1)).toBe(dest);
    let current = start;
    for (const step of steps) {
      expect(blocked.has(step)).toBe(false);
      expect(findAdjacentHexes(current, { width })).toContain(step);
      current = step;
    }
  });

  it('returns null when destination is sealed off', () => {
    const start = 0;
    const dest = 8;
    const blockedNeighbors = new Set(findAdjacentHexes(dest, { width }));
    const path = findPath(start, dest, {
      width,
      height,
      isBlocked: (index) => blockedNeighbors.has(index),
    });
    expect(path).toBeNull();
  });
});
