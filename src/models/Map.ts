import { Critter } from './Critter';
import { Item } from './Item';

export interface HexCoords {
  x: number;
  y: number;
}

export class MapInstance {
  public readonly id: number;
  public readonly protoId: number;
  public readonly name: string;
  public readonly width: number;
  public readonly height: number;
  public items: Map<number, Item> = new Map();
  public critters: Map<number, Critter> = new Map();

  constructor(options: {
    id: number;
    protoId: number;
    name: string;
    width: number;
    height: number;
  }) {
    this.id = options.id;
    this.protoId = options.protoId;
    this.name = options.name;
    this.width = options.width;
    this.height = options.height;
  }

  placeItem(item: Item, coords: HexCoords): void {
    item.position = { mapId: this.id, hexX: coords.x, hexY: coords.y };
    this.items.set(item.id, item);
  }

  removeItem(itemId: number): Item | undefined {
    const item = this.items.get(itemId);
    if (item) {
      this.items.delete(itemId);
    }
    return item;
  }

  placeCritter(critter: Critter, coords: HexCoords, direction: number): void {
    critter.position = { mapId: this.id, hexX: coords.x, hexY: coords.y, direction };
    this.critters.set(critter.id, critter);
  }

  removeCritter(critterId: number): Critter | undefined {
    const critter = this.critters.get(critterId);
    if (critter) {
      this.critters.delete(critterId);
    }
    return critter;
  }
}
