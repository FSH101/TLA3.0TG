import type { Hex } from "./hex";

export type MapLayer = "floor" | "wall" | "object";

export interface MapTile {
  layer: MapLayer;
  q: number;
  r: number;
  id: string;
  block?: boolean;
  light?: number;
}

export interface MapJSON {
  id: string;
  size: {
    width: number;
    height: number;
  };
  tiles: MapTile[];
  spawns?: {
    player?: Hex[];
  };
}
