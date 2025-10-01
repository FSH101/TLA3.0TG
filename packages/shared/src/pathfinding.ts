import { findAdjacentHexes, heuristicDistance, GeometryOptions } from './geometry.js';

export interface FindPathOptions extends GeometryOptions {
  height?: number;
  isBlocked?: (index: number) => boolean;
}

export function findPath(start: number, dest: number, options: FindPathOptions = {}): number[] | null {
  if (start === dest) {
    return [];
  }

  const neighborsOptions: GeometryOptions = { width: options.width };
  const isBlocked = options.isBlocked ?? (() => false);
  const height =
    typeof options.height === 'number' && Number.isFinite(options.height) && options.height > 0
      ? Math.trunc(options.height)
      : undefined;
  const width =
    typeof options.width === 'number' && Number.isFinite(options.width) && options.width > 0
      ? Math.trunc(options.width)
      : undefined;
  const maxIndex = typeof height === 'number' && typeof width === 'number' ? height * width - 1 : undefined;

  const closed = new Set<number>();
  const frontier: number[] = [start];
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();

  gScore.set(start, 0);
  fScore.set(start, heuristicDistance(start, dest, neighborsOptions));

  while (frontier.length > 0) {
    let currentIndex = 0;
    let current = frontier[0];
    for (let i = 1; i < frontier.length; i += 1) {
      const node = frontier[i];
      if ((fScore.get(node) ?? Number.POSITIVE_INFINITY) < (fScore.get(current) ?? Number.POSITIVE_INFINITY)) {
        current = node;
        currentIndex = i;
      }
    }

    if (current === dest) {
      const path: number[] = [dest];
      while (cameFrom.has(current)) {
        current = cameFrom.get(current)!;
        if (current === start) {
          break;
        }
        path.unshift(current);
      }
      return path;
    }

    frontier.splice(currentIndex, 1);
    closed.add(current);

    for (const neighbor of findAdjacentHexes(current, neighborsOptions)) {
      if (neighbor < 0) {
        continue;
      }
      if (typeof maxIndex === 'number' && neighbor > maxIndex) {
        continue;
      }
      if (closed.has(neighbor)) {
        continue;
      }
      if (isBlocked(neighbor)) {
        closed.add(neighbor);
        continue;
      }

      const tentativeG = (gScore.get(current) ?? Number.POSITIVE_INFINITY) +
        heuristicDistance(current, neighbor, neighborsOptions);

      const existing = gScore.get(neighbor);
      const hasBetterScore = existing !== undefined && tentativeG >= existing;
      if (hasBetterScore) {
        continue;
      }

      cameFrom.set(neighbor, current);
      gScore.set(neighbor, tentativeG);
      fScore.set(neighbor, tentativeG + heuristicDistance(neighbor, dest, neighborsOptions));

      if (!frontier.includes(neighbor)) {
        frontier.push(neighbor);
      }
    }
  }

  return null;
}
