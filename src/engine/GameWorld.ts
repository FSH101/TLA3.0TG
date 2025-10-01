import {
  AccessoryType,
  Critter,
  CritterCondition,
  GameVar,
  Item,
  ItemType,
  Location,
  MapInstance,
} from '@models';
import { AssetManager, AssetDescriptor, AssetRecord } from './AssetManager';
import { TimeEventHandler, TimeEventPayload, TimeEventScheduler } from '@systems/TimeEventScheduler';

interface GameWorldOptions {
  assetManager?: AssetManager;
  timeEventScheduler?: TimeEventScheduler;
}

interface CreateItemOptions {
  protoId: number;
  type: ItemType;
  amount?: number;
  flags?: number;
}

interface CreateCritterOptions {
  protoId: number;
  name: string;
  gender?: number;
  mapId: number;
  hexX: number;
  hexY: number;
  direction: number;
  stats?: Record<string, number>;
}

interface CreateMapOptions {
  protoId: number;
  name: string;
  width: number;
  height: number;
}

interface CreateLocationOptions {
  protoId: number;
  name: string;
  worldX: number;
  worldY: number;
}

type AnyDataRecord = number[] | Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | BigInt64Array | BigUint64Array;

export class GameWorld {
  private readonly assetManager: AssetManager;
  private readonly scheduler: TimeEventScheduler;

  private readonly items = new Map<number, Item>();
  private readonly critters = new Map<number, Critter>();
  private readonly locations = new Map<number, Location>();
  private readonly maps = new Map<number, MapInstance>();
  private readonly playersByName = new Map<string, number>();

  private readonly globalVars = new Map<number, GameVar>();
  private readonly localVars = new Map<string, GameVar>();
  private readonly uniqueVars = new Map<string, GameVar>();
  private readonly anyData = new Map<string, AnyDataRecord>();

  private itemIdCounter = 1;
  private critterIdCounter = 1;
  private locationIdCounter = 1;
  private mapIdCounter = 1;

  constructor(options: GameWorldOptions = {}) {
    this.assetManager = options.assetManager ?? new AssetManager();
    this.scheduler = options.timeEventScheduler ?? new TimeEventScheduler();
  }

  async initialize(): Promise<void> {
    await this.assetManager.loadManifest();
  }

  getAssetDescriptor(id: string): AssetDescriptor | undefined {
    return this.assetManager.getDescriptor(id);
  }

  async preloadAssets(ids: string[]): Promise<void> {
    await this.assetManager.preloadAssets(ids);
  }

  getCachedAsset(id: string): AssetRecord | undefined {
    return this.assetManager.getCachedAsset(id);
  }

  registerTimeEventHandler(name: string, handler: TimeEventHandler): void {
    this.scheduler.registerHandler(name, handler);
  }

  createTimeEvent(ownerId: number, handlerName: string, intervalMs: number, payload: TimeEventPayload = [], repeat = false): number {
    return this.scheduler.createEvent(ownerId, handlerName, intervalMs, payload, repeat);
  }

  eraseTimeEvent(eventId: number): boolean {
    return this.scheduler.eraseEvent(eventId);
  }

  setTimeEventInterval(eventId: number, intervalMs: number): boolean {
    return this.scheduler.setEventInterval(eventId, intervalMs);
  }

  getTimeEvent(eventId: number): TimeEventPayload | undefined {
    const scheduled = this.scheduler.getEvent(eventId);
    return scheduled?.payload;
  }

  getGlobalVar(id: number): GameVar {
    let variable = this.globalVars.get(id);
    if (!variable) {
      variable = new GameVar(id, 'global', 0);
      this.globalVars.set(id, variable);
    }
    return variable;
  }

  getLocalVar(scriptId: number, index: number): GameVar {
    const key = `${scriptId}:${index}`;
    let variable = this.localVars.get(key);
    if (!variable) {
      variable = new GameVar(index, 'local', 0);
      this.localVars.set(key, variable);
    }
    return variable;
  }

  getUniqueVar(scriptId: number, index: number, uniqueId: number): GameVar {
    const key = `${scriptId}:${index}:${uniqueId}`;
    let variable = this.uniqueVars.get(key);
    if (!variable) {
      variable = new GameVar(index, 'unique', 0);
      this.uniqueVars.set(key, variable);
    }
    return variable;
  }

  createItem(options: CreateItemOptions): Item {
    const item = new Item({
      id: this.itemIdCounter++,
      protoId: options.protoId,
      type: options.type,
      amount: options.amount,
      flags: options.flags,
    });
    this.items.set(item.id, item);
    return item;
  }

  getItem(id: number): Item | undefined {
    return this.items.get(id);
  }

  deleteItem(id: number): boolean {
    const item = this.items.get(id);
    if (!item) {
      return false;
    }

    if (item.position.containerId) {
      const container = this.items.get(item.position.containerId);
      container?.children.delete(id);
    }

    if (item.position.mapId) {
      this.maps.get(item.position.mapId)?.items.delete(id);
    }

    for (const [, critter] of this.critters) {
      if (critter.inventory.has(id)) {
        critter.inventory.delete(id);
      }
    }

    this.items.delete(id);
    return true;
  }

  moveItemToCritter(itemId: number, critterId: number): boolean {
    const item = this.items.get(itemId);
    const critter = this.critters.get(critterId);
    if (!item || !critter) {
      return false;
    }

    this.detachItem(item);
    critter.addItem(item);
    item.accessory = AccessoryType.Critter;
    item.position = { containerId: critter.id };
    return true;
  }

  moveItemToContainer(itemId: number, containerId: number): boolean {
    const item = this.items.get(itemId);
    const container = this.items.get(containerId);
    if (!item || !container) {
      return false;
    }

    this.detachItem(item);
    container.children.set(item.id, item);
    item.accessory = AccessoryType.Container;
    item.position = { containerId };
    return true;
  }

  moveItemToMap(itemId: number, mapId: number, hexX: number, hexY: number): boolean {
    const item = this.items.get(itemId);
    const map = this.maps.get(mapId);
    if (!item || !map) {
      return false;
    }

    this.detachItem(item);
    map.placeItem(item, { x: hexX, y: hexY });
    item.accessory = AccessoryType.Hex;
    item.position = { mapId, hexX, hexY };
    return true;
  }

  moveItemsToCritter(itemIds: number[], critterId: number): boolean {
    return itemIds.every((id) => this.moveItemToCritter(id, critterId));
  }

  moveItemsToContainer(itemIds: number[], containerId: number): boolean {
    return itemIds.every((id) => this.moveItemToContainer(id, containerId));
  }

  moveItemsToMap(itemIds: number[], mapId: number, hexX: number, hexY: number): boolean {
    return itemIds.every((id) => this.moveItemToMap(id, mapId, hexX, hexY));
  }

  private detachItem(item: Item): void {
    if (item.position.containerId) {
      this.items.get(item.position.containerId)?.children.delete(item.id);
    }

    if (item.position.mapId) {
      this.maps.get(item.position.mapId)?.items.delete(item.id);
    }

    for (const [, critter] of this.critters) {
      if (critter.inventory.has(item.id)) {
        critter.inventory.delete(item.id);
      }
    }
  }

  registerCritter(options: CreateCritterOptions): Critter {
    const map = this.maps.get(options.mapId);
    if (!map) {
      throw new Error(`Map ${options.mapId} does not exist`);
    }

    const critter = new Critter({
      id: this.critterIdCounter++,
      protoId: options.protoId,
      name: options.name,
      gender: options.gender,
      position: {
        mapId: options.mapId,
        hexX: options.hexX,
        hexY: options.hexY,
        direction: options.direction,
      },
      stats: options.stats,
    });

    this.critters.set(critter.id, critter);
    map.placeCritter(critter, { x: options.hexX, y: options.hexY }, options.direction);
    this.playersByName.set(critter.name.toLowerCase(), critter.id);
    return critter;
  }

  getCritter(id: number): Critter | undefined {
    return this.critters.get(id);
  }

  getPlayer(name: string): Critter | undefined {
    const id = this.playersByName.get(name.toLowerCase());
    return id ? this.critters.get(id) : undefined;
  }

  getPlayerId(name: string): number | undefined {
    return this.playersByName.get(name.toLowerCase());
  }

  deleteCritter(id: number): boolean {
    const critter = this.critters.get(id);
    if (!critter) {
      return false;
    }

    const map = this.maps.get(critter.position.mapId);
    map?.critters.delete(id);
    this.playersByName.delete(critter.name.toLowerCase());
    this.critters.delete(id);
    return true;
  }

  setCritterCondition(id: number, condition: CritterCondition): boolean {
    const critter = this.critters.get(id);
    if (!critter) {
      return false;
    }

    critter.condition = condition;
    return true;
  }

  createMap(options: CreateMapOptions): MapInstance {
    const map = new MapInstance({
      id: this.mapIdCounter++,
      protoId: options.protoId,
      name: options.name,
      width: options.width,
      height: options.height,
    });
    this.maps.set(map.id, map);
    return map;
  }

  getMap(id: number): MapInstance | undefined {
    return this.maps.get(id);
  }

  deleteMap(id: number): boolean {
    const map = this.maps.get(id);
    if (!map) {
      return false;
    }

    for (const itemId of map.items.keys()) {
      this.items.delete(itemId);
    }
    for (const critterId of map.critters.keys()) {
      this.critters.delete(critterId);
    }

    this.maps.delete(id);
    return true;
  }

  createLocation(options: CreateLocationOptions): Location {
    const location = new Location({
      id: this.locationIdCounter++,
      protoId: options.protoId,
      worldX: options.worldX,
      worldY: options.worldY,
      name: options.name,
    });
    this.locations.set(location.id, location);
    return location;
  }

  getLocation(id: number): Location | undefined {
    return this.locations.get(id);
  }

  deleteLocation(id: number): boolean {
    const location = this.locations.get(id);
    if (!location) {
      return false;
    }

    for (const mapId of location.maps.keys()) {
      this.deleteMap(mapId);
    }

    this.locations.delete(id);
    return true;
  }

  attachMapToLocation(locationId: number, mapId: number): boolean {
    const location = this.locations.get(locationId);
    const map = this.maps.get(mapId);
    if (!location || !map) {
      return false;
    }
    location.attachMap(map);
    return true;
  }

  radioMessage(channel: number, text: string): void {
    console.info(`[Radio ${channel}] ${text}`);
  }

  setAnyData(key: string, value: AnyDataRecord): boolean {
    this.anyData.set(key, value);
    return true;
  }

  getAnyData(key: string): AnyDataRecord | undefined {
    return this.anyData.get(key);
  }

  hasAnyData(key: string): boolean {
    return this.anyData.has(key);
  }

  eraseAnyData(key: string): void {
    this.anyData.delete(key);
  }

  synchronize(): void {
    // In the browser port this method is a no-op but maintained for API compatibility.
  }

  resynchronize(): void {
    // In the browser port this method is a no-op but maintained for API compatibility.
  }

  getAllItems(): Item[] {
    return Array.from(this.items.values());
  }

  getAllCritters(): Critter[] {
    return Array.from(this.critters.values());
  }

  getAllMaps(): MapInstance[] {
    return Array.from(this.maps.values());
  }

  getAllLocations(): Location[] {
    return Array.from(this.locations.values());
  }
}
