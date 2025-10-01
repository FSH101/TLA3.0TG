import { AccessoryType, ItemFlag, ItemType } from './enums';

export interface ItemPosition {
  mapId?: number;
  hexX?: number;
  hexY?: number;
  containerId?: number;
  slotId?: number;
}

export class Item {
  public readonly id: number;
  public readonly protoId: number;
  public readonly type: ItemType;
  public flags: number;
  public amount: number;
  public data: Map<string, unknown> = new Map();
  public accessory: AccessoryType = AccessoryType.None;
  public position: ItemPosition = {};
  public readonly children: Map<number, Item> = new Map();

  constructor(options: {
    id: number;
    protoId: number;
    type: ItemType;
    flags?: number;
    amount?: number;
    accessory?: AccessoryType;
    position?: ItemPosition;
  }) {
    this.id = options.id;
    this.protoId = options.protoId;
    this.type = options.type;
    this.flags = options.flags ?? 0;
    this.amount = options.amount ?? 1;
    this.accessory = options.accessory ?? AccessoryType.None;
    this.position = options.position ?? {};
  }

  hasFlag(flag: ItemFlag): boolean {
    return (this.flags & flag) === flag;
  }

  toggleFlag(flag: ItemFlag, value: boolean): void {
    if (value) {
      this.flags |= flag;
    } else {
      this.flags &= ~flag;
    }
  }
}
