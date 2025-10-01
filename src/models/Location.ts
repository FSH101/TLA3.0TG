import { MapInstance } from './Map';

export class Location {
  public readonly id: number;
  public readonly protoId: number;
  public readonly worldX: number;
  public readonly worldY: number;
  public readonly name: string;
  public readonly maps: Map<number, MapInstance> = new Map();

  constructor(options: {
    id: number;
    protoId: number;
    worldX: number;
    worldY: number;
    name: string;
  }) {
    this.id = options.id;
    this.protoId = options.protoId;
    this.worldX = options.worldX;
    this.worldY = options.worldY;
    this.name = options.name;
  }

  attachMap(map: MapInstance): void {
    this.maps.set(map.id, map);
  }

  detachMap(mapId: number): MapInstance | undefined {
    const map = this.maps.get(mapId);
    if (map) {
      this.maps.delete(mapId);
    }
    return map;
  }
}
