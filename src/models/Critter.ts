import { CritterCondition, Gender } from './enums';
import { Item } from './Item';

export interface CritterPosition {
  mapId: number;
  hexX: number;
  hexY: number;
  direction: number;
}

export interface CritterStats {
  [key: string]: number;
}

export class Critter {
  public readonly id: number;
  public readonly protoId: number;
  public name: string;
  public gender: Gender;
  public condition: CritterCondition = CritterCondition.Life;
  public position: CritterPosition;
  public stats: CritterStats;
  public inventory: Map<number, Item> = new Map();

  constructor(options: {
    id: number;
    protoId: number;
    name: string;
    gender?: Gender;
    position: CritterPosition;
    stats?: CritterStats;
  }) {
    this.id = options.id;
    this.protoId = options.protoId;
    this.name = options.name;
    this.gender = options.gender ?? Gender.Male;
    this.position = options.position;
    this.stats = options.stats ?? {};
  }

  addItem(item: Item): void {
    this.inventory.set(item.id, item);
  }

  removeItem(itemId: number): Item | undefined {
    const item = this.inventory.get(itemId);
    if (item) {
      this.inventory.delete(itemId);
    }
    return item;
  }

  listItems(): Item[] {
    return Array.from(this.inventory.values());
  }
}
