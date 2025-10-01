export interface HexPixelMetrics {
  tileWidth: number;
  tileHeight: number;
  elevation: number;
}

export interface HexGridInfo {
  orientation: 'pointy' | 'flat' | 'isometric';
  size: number;
  pixel?: HexPixelMetrics;
}

export interface MapTile {
  q: number;
  r: number;
  layer: 'ground' | 'roof';
  art: string;
}

export interface MapObject {
  id: string;
  q: number;
  r: number;
  elev: number;
  dir: number;
  art: string;
}

export interface MapData {
  id: string;
  name?: string;
  hex: HexGridInfo;
  size: { w: number; h: number };
  tiles: MapTile[];
  objects: MapObject[];
  assets?: Record<string, AssetDescriptor | undefined>;
}

export interface AssetDescriptor {
  kind: string;
  category: string;
  outDir: string;
  dirs: number;
  framesPerDir: number;
  size: { maxW: number; maxH: number };
  anchorAvg: { xOff: number; yOff: number };
}

export interface MapSummary {
  id: string;
  name: string;
  hex: HexGridInfo;
  tiles: number;
  objects: number;
}

export type ImageCache = Map<string, HTMLImageElement>;
