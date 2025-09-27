import { Application, Container, Graphics, Texture, Sprite, Assets, type ApplicationOptions } from "pixi.js";
import type { Hex, MapJSON, MapLayer, ServerMsg, ClientMsg } from "@tla/shared";
import {
  applyPalette,
  FALLOUT_GIMP_PALETTE,
  hexToWorld,
  parseFr,
  worldToHex,
  HEX_TILE_WIDTH,
  HEX_TILE_HEIGHT,
} from "@tla/shared";
import { BUILD_VERSION, MAX_SCALE, MIN_SCALE } from "./constants";
import { GameHud } from "./hud";
import { MapEditor, type EditorMode } from "./editor";
import { ToastManager } from "./toast";

interface PlayerMarker {
  id: string;
  sprite: Graphics;
}

interface PointerState {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
}

interface GameClientOptions {
  root: HTMLElement;
  nick: string;
}

export class GameClient {
  private app!: Application;
  private world!: Container;
  private floorLayer!: Container;
  private wallLayer!: Container;
  private objectLayer!: Container;
  private markersLayer!: Container;
  private overlayLayer!: Container;
  private gridLayer!: Graphics;
  private selectedMarker!: Graphics;
  private localMarker!: Graphics;
  private debugCharacter: Sprite | null = null;
  private otherMarkers = new Map<string, PlayerMarker>();
  private hud!: GameHud;
  private editor!: MapEditor;
  private toast!: ToastManager;
  private isGridVisible = true;
  private ws: WebSocket | null = null;
  private playerId: string | null = null;
  private currentMap: MapJSON | null = null;
  private tileIndex = new Map<string, Sprite>();
  private pointerMap = new Map<number, PointerState>();
  private isDragging = false;
  private dragMoved = false;
  private initialDistance = 0;
  private initialScale = 1;
  private lastHighlight: Hex = { q: 0, r: 0 };
  private lastTouchTime = 0;
  private disposed = false;
  private initialized = false;

  private floorTexture!: Texture;
  private wallTexture!: Texture;
  private objectTexture!: Texture;
  constructor(private readonly options: GameClientOptions) {}

  async init(): Promise<void> {
    this.app = await this.createApplication();
    this.options.root.appendChild(this.app.canvas);

    this.world = new Container();
    this.floorLayer = new Container();
    this.wallLayer = new Container();
    this.objectLayer = new Container();
    this.markersLayer = new Container();
    this.overlayLayer = new Container();
    this.gridLayer = new Graphics();

    this.world.addChild(
      this.floorLayer,
      this.wallLayer,
      this.objectLayer,
      this.gridLayer,
      this.markersLayer,
      this.overlayLayer,
    );
    this.app.stage.addChild(this.world);

    await this.loadTextures();
    this.createHighlight();
    this.createLocalMarker();

    this.toast = new ToastManager(this.options.root);
    this.hud = new GameHud(this.options.root, {
      onToggleEditor: () => this.toggleEditor(),
      onSave: () => this.downloadMap(),
      onLoad: (file) => this.loadMapFile(file),
      onExport: () => this.exportPng(),
      onFullscreen: () => this.toggleFullscreen(),
    });

    this.editor = new MapEditor(this.options.root);
    this.editor.setMapHandlers(
      (map) => this.triggerDownload(map),
      (map) => this.setMap(map),
    );

    if (import.meta.env.DEV) {
      await this.loadDebugScene();
    }

    this.setupInteractions();
    this.setupKeyboardShortcuts();
    document.addEventListener("fullscreenchange", () => {
      this.hud.showFullscreenButton(!document.fullscreenElement);
    });
    this.registerServiceWorker();
    this.connect();
    this.initialized = true;
    if (this.disposed) {
      this.performDestroy();
    }
  }

  private async createApplication(): Promise<Application> {
    const options: ApplicationOptions = {
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: this.options.root,
    };

    const ctor = Application as typeof Application & {
      init?: (opts: ApplicationOptions) => Promise<Application>;
    };

    if (typeof ctor.init === "function") {
      return await ctor.init(options);
    }

    const app = new Application(options);
    const maybeInit = app as Application & { init?: () => Promise<void> };
    if (typeof maybeInit.init === "function") {
      await maybeInit.init();
    }
    return app;
  }

  destroy(): void {
    this.disposed = true;
    if (!this.initialized) return;
    this.performDestroy();
  }

  private performDestroy(): void {
    this.ws?.close();
    this.app.destroy(true, { children: true });
  }

  private async loadTextures(): Promise<void> {
    if (!import.meta.env.DEV) {
      this.useGeneratedTextures();
      return;
    }

    const textureNames = ["en1.png", "en2.png", "en4.png"];
    const baseCandidates = ["/assets", "/debug"];
    const failures: Array<{ base: string; file?: string; error: unknown }> = [];

    for (const base of baseCandidates) {
      const textures: Texture[] = [];
      let success = true;
      for (const file of textureNames) {
        try {
          textures.push(await this.loadTexture(`${base}/${file}`));
        } catch (error) {
          failures.push({ base, file, error });
          success = false;
          break;
        }
      }
      if (success) {
        [this.floorTexture, this.wallTexture, this.objectTexture] = textures;
        return;
      }
    }

    if (failures.length > 0) {
      console.warn(
        "Не удалось загрузить отладочные текстуры ни из одной директории, используются материалы по умолчанию",
        failures,
      );
    }
    this.useGeneratedTextures();
  }

  private async loadTexture(url: string): Promise<Texture> {
    return await Assets.load<Texture>(url);
  }

  private useGeneratedTextures(): void {
    this.floorTexture = this.createTileTexture(0x1c2432, 0x2f3a4b);
    this.wallTexture = this.createTileTexture(0x31394a, 0x46536a);
    this.objectTexture = this.createTileTexture(0x46536a, 0x5e6f89);
  }

  private createTileTexture(fill: number, outline: number): Texture {
    const g = new Graphics();
    const w = HEX_TILE_WIDTH / 2;
    const h = HEX_TILE_HEIGHT / 2;
    g.beginFill(fill, 0.95);
    g.lineStyle({ color: outline, width: 1, alignment: 0.5, alpha: 0.6 });
    g.moveTo(0, -h);
    g.lineTo(w, 0);
    g.lineTo(0, h);
    g.lineTo(-w, 0);
    g.closePath();
    g.endFill();
    const texture = this.app.renderer.generateTexture({
      target: g,
      resolution: window.devicePixelRatio,
    });
    g.destroy();
    return texture;
  }

  private createHighlight(): void {
    this.selectedMarker = new Graphics();
    const w = HEX_TILE_WIDTH / 2;
    const h = HEX_TILE_HEIGHT / 2;
    this.selectedMarker.lineStyle({ color: 0xff5555, width: 3, alignment: 0.5 });
    this.selectedMarker.moveTo(0, -h);
    this.selectedMarker.lineTo(w, 0);
    this.selectedMarker.lineTo(0, h);
    this.selectedMarker.lineTo(-w, 0);
    this.selectedMarker.closePath();
    this.selectedMarker.alpha = 0.9;
    this.overlayLayer.addChild(this.selectedMarker);
  }

  private createLocalMarker(): void {
    this.localMarker = new Graphics();
    this.localMarker.beginFill(0x0b0b10);
    this.localMarker.drawCircle(0, 0, HEX_TILE_HEIGHT * 0.35);
    this.localMarker.endFill();
    this.markersLayer.addChild(this.localMarker);
  }

  private async loadDebugScene(): Promise<void> {
    const width = 12;
    const height = 10;
    const debugMap: MapJSON = {
      id: "debug-map",
      size: { width, height },
      tiles: [],
    };

    this.setMap(debugMap);

    const playerHex: Hex = { q: Math.floor(width / 2), r: Math.floor(height / 2) };
    const { x, y } = hexToWorld(playerHex);
    this.localMarker.position.set(x, y);
    this.updateHighlight(playerHex);

    await this.spawnDebugCharacter(playerHex);
  }

  private async spawnDebugCharacter(pos: Hex): Promise<void> {
    try {
      const frmCandidates = ["/assets/HMCLJTAA.FRM", "/debug/HMCLJTAA.FRM"];
      let buffer: ArrayBuffer | null = null;
      const failures: Array<{ path: string; error: unknown }> = [];

      for (const path of frmCandidates) {
        try {
          const response = await fetch(path);
          if (!response.ok) {
            failures.push({ path, error: new Error(`HTTP ${response.status}`) });
            continue;
          }
          buffer = await response.arrayBuffer();
          break;
        } catch (error) {
          failures.push({ path, error });
        }
      }

      if (!buffer) {
        throw failures.length > 0 ? failures : new Error("FRM-файл не найден ни в одной директории");
      }

      const decoded = parseFr(buffer);
      const frames = applyPalette(decoded, FALLOUT_GIMP_PALETTE);
      const frame = frames[0]?.[0];
      if (!frame) {
        throw new Error("Файл FRM не содержит кадров");
      }

      const rgba = frame.rgba instanceof Uint8ClampedArray ? new Uint8Array(frame.rgba) : frame.rgba;
      const texture = Texture.fromBuffer(rgba, frame.w, frame.h);

      this.debugCharacter?.destroy();
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 0.88);

      const { x, y } = hexToWorld(pos);
      sprite.position.set(x, y + HEX_TILE_HEIGHT * 0.5);

      this.objectLayer.addChild(sprite);
      this.debugCharacter = sprite;
    } catch (error) {
      console.warn("Не удалось загрузить отладочного персонажа", error);
    }
  }

  private setupInteractions(): void {
    const canvas = this.app.canvas;
    canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    canvas.addEventListener("pointercancel", (event) => this.onPointerUp(event));
    canvas.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
    window.addEventListener("resize", () => this.recenterWorld());
  }

  private setupKeyboardShortcuts(): void {
    window.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case "e":
          this.toggleEditor();
          break;
        case "g":
          this.isGridVisible = !this.isGridVisible;
          this.gridLayer.visible = this.isGridVisible;
          break;
        case "f":
          this.toggleFullscreen();
          break;
      }
    });
  }

  private onPointerDown(event: PointerEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const state: PointerState = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    this.pointerMap.set(event.pointerId, state);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (this.pointerMap.size === 1) {
      this.isDragging = true;
      this.dragMoved = false;
      this.lastTouchTime = Date.now();
    } else if (this.pointerMap.size === 2) {
      const [a, b] = Array.from(this.pointerMap.values());
      this.initialDistance = distance(a.startX, a.startY, b.startX, b.startY);
      this.initialScale = this.world.scale.x;
    }
    if (isMobile()) {
      this.hud.showFullscreenButton(!document.fullscreenElement);
    }
    const hex = this.screenToHex(event.clientX - rect.left, event.clientY - rect.top);
    this.updateHighlight(hex);
  }

  private onPointerMove(event: PointerEvent): void {
    const state = this.pointerMap.get(event.pointerId);
    if (!state) return;
    const canvasRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const localX = event.clientX - canvasRect.left;
    const localY = event.clientY - canvasRect.top;

    if (this.pointerMap.size === 1) {
      if (this.isDragging) {
        const dx = event.clientX - state.lastX;
        const dy = event.clientY - state.lastY;
        if (Math.abs(event.clientX - state.startX) > 2 || Math.abs(event.clientY - state.startY) > 2) {
          this.dragMoved = true;
        }
        this.world.position.x += dx;
        this.world.position.y += dy;
      }
      const hex = this.screenToHex(localX, localY);
      this.updateHighlight(hex);
    } else if (this.pointerMap.size === 2) {
      this.pointerMap.set(event.pointerId, {
        ...state,
        lastX: event.clientX,
        lastY: event.clientY,
      });
      const [a, b] = Array.from(this.pointerMap.values());
      const dist = distance(a.lastX, a.lastY, b.lastX, b.lastY);
      const scale = clamp((dist / this.initialDistance) * this.initialScale, MIN_SCALE, MAX_SCALE);
      this.setScale(scale, localX, localY);
    }

    state.lastX = event.clientX;
    state.lastY = event.clientY;
  }

  private onPointerUp(event: PointerEvent): void {
    const state = this.pointerMap.get(event.pointerId);
    if (!state) return;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    this.pointerMap.delete(event.pointerId);
    if (this.pointerMap.size <= 1) {
      this.initialDistance = 0;
    }
    const elapsed = Date.now() - this.lastTouchTime;
    if (!this.dragMoved && elapsed < 250) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const hex = this.screenToHex(event.clientX - rect.left, event.clientY - rect.top);
      this.handleTap(hex);
    }
    this.isDragging = false;
    this.dragMoved = false;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const direction = event.deltaY > 0 ? -1 : 1;
    const zoomFactor = 0.1;
    const targetScale = clamp(this.world.scale.x + zoomFactor * direction, MIN_SCALE, MAX_SCALE);
    this.setScale(targetScale, mouseX, mouseY);
  }

  private setScale(scale: number, centerX: number, centerY: number): void {
    const worldPosBefore = this.world.toLocal({ x: centerX, y: centerY });
    this.world.scale.set(scale);
    const worldPosAfter = this.world.toGlobal(worldPosBefore);
    this.world.position.x += centerX - worldPosAfter.x;
    this.world.position.y += centerY - worldPosAfter.y;
  }

  private screenToHex(x: number, y: number): Hex {
    const global = this.world.toLocal({ x, y });
    return worldToHex(global.x, global.y);
  }

  private updateHighlight(hex: Hex): void {
    this.lastHighlight = hex;
    const { x, y } = hexToWorld(hex);
    this.selectedMarker.position.set(x, y);
    this.hud.updateCoords(hex.q, hex.r);
  }

  private handleTap(hex: Hex): void {
    if (!this.currentMap) return;
    if (this.editor.isVisible()) {
      this.applyEditorAction(hex);
      return;
    }
    this.sendMove(hex);
  }

  private applyEditorAction(hex: Hex): void {
    const mode: EditorMode = this.editor.getMode();
    const layer = this.editor.getLayer();
    const key = tileKey(layer, hex.q, hex.r);
    if (mode === "paint") {
      const tileId = this.editor.getTileId();
      this.upsertTile(layer, hex.q, hex.r, tileId);
    } else {
      this.removeTile(layer, hex.q, hex.r);
      this.tileIndex.delete(key);
    }
  }

  private async connect(): Promise<void> {
    const url = getSocketUrl();
    this.ws = new WebSocket(url);
    this.ws.addEventListener("open", () => {
      const join: ClientMsg = {
        type: "join",
        room: "demo",
        nick: this.options.nick,
        build: BUILD_VERSION,
      };
      this.ws?.send(JSON.stringify(join));
    });

    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data) as ServerMsg;
      this.handleServerMessage(msg);
    });

    this.ws.addEventListener("close", () => {
      this.toast.push("Соединение с сервером потеряно");
    });
  }

  private handleServerMessage(msg: ServerMsg): void {
    switch (msg.type) {
      case "hello":
        this.playerId = msg.you;
        this.setMap(msg.map);
        this.setPlayers(msg.players);
        break;
      case "player-joined":
        if (msg.id !== this.playerId) {
          this.toast.push(`Игрок подключился: ${msg.id}`);
          this.addRemotePlayer(msg.id, msg.pos);
        }
        break;
      case "player-moved":
        this.updatePlayer(msg.id, msg.to);
        break;
      case "player-left":
        this.removePlayer(msg.id);
        this.toast.push(`Игрок отключился: ${msg.id}`);
        break;
    }
  }

  private setMap(map: MapJSON): void {
    this.currentMap = map;
    this.tileIndex.clear();
    this.floorLayer.removeChildren();
    this.wallLayer.removeChildren();
    this.objectLayer.removeChildren();
    this.gridLayer.clear();
    this.debugCharacter?.destroy();
    this.debugCharacter = null;

    for (let q = 0; q < map.size.width; q += 1) {
      for (let r = 0; r < map.size.height; r += 1) {
        const sprite = new Sprite(this.floorTexture);
        sprite.anchor.set(0.5);
        const { x, y } = hexToWorld({ q, r });
        sprite.position.set(x, y);
        this.floorLayer.addChild(sprite);
        this.tileIndex.set(tileKey("floor", q, r), sprite);
      }
    }

    map.tiles.forEach((tile) => {
      this.upsertTile(tile.layer, tile.q, tile.r, tile.id);
    });

    this.drawGrid(map.size.width, map.size.height);
    this.recenterWorld();
  }

  private drawGrid(width: number, height: number): void {
    this.gridLayer.clear();
    if (!this.isGridVisible) {
      this.gridLayer.visible = false;
      return;
    }
    this.gridLayer.visible = true;
    this.gridLayer.lineStyle({ color: 0x29303f, width: 1, alignment: 0.5, alpha: 0.6 });
    for (let q = 0; q < width; q += 1) {
      for (let r = 0; r < height; r += 1) {
        const { x, y } = hexToWorld({ q, r });
        const w = HEX_TILE_WIDTH / 2;
        const h = HEX_TILE_HEIGHT / 2;
        this.gridLayer.moveTo(x, y - h);
        this.gridLayer.lineTo(x + w, y);
        this.gridLayer.lineTo(x, y + h);
        this.gridLayer.lineTo(x - w, y);
        this.gridLayer.lineTo(x, y - h);
      }
    }
  }

  private recenterWorld(): void {
    if (!this.currentMap) return;
    const { width, height } = this.currentMap.size;
    const centerHex = { q: width / 2, r: height / 2 };
    const { x, y } = hexToWorld(centerHex);
    this.world.position.set(this.app.screen.width / 2 - x * this.world.scale.x, this.app.screen.height / 2 - y * this.world.scale.y);
  }

  private upsertTile(layer: MapLayer, q: number, r: number, tileId: string): void {
    if (!this.currentMap) return;
    const key = tileKey(layer, q, r);
    const container = this.getLayerContainer(layer);
    let sprite = this.tileIndex.get(key);
    if (!sprite) {
      sprite = new Sprite(this.textureForLayer(layer));
      sprite.anchor.set(0.5);
      container.addChild(sprite);
      this.tileIndex.set(key, sprite);
    }
    sprite.texture = this.textureForLayer(layer);
    const { x, y } = hexToWorld({ q, r });
    sprite.position.set(x, y);

    const tiles = this.currentMap.tiles;
    const idx = tiles.findIndex((t) => t.layer === layer && t.q === q && t.r === r);
    if (idx >= 0) {
      tiles[idx].id = tileId;
    } else {
      tiles.push({ layer, q, r, id: tileId });
    }
  }

  private removeTile(layer: MapLayer, q: number, r: number): void {
    if (!this.currentMap) return;
    const key = tileKey(layer, q, r);
    const sprite = this.tileIndex.get(key);
    if (sprite) {
      if (layer === "floor") {
        sprite.texture = this.floorTexture;
      } else {
        sprite.destroy();
        this.tileIndex.delete(key);
      }
    }
    const tiles = this.currentMap.tiles;
    const idx = tiles.findIndex((t) => t.layer === layer && t.q === q && t.r === r);
    if (idx >= 0) {
      tiles.splice(idx, 1);
    }
  }

  private getLayerContainer(layer: MapLayer): Container {
    switch (layer) {
      case "floor":
        return this.floorLayer;
      case "wall":
        return this.wallLayer;
      case "object":
      default:
        return this.objectLayer;
    }
  }

  private textureForLayer(layer: MapLayer): Texture {
    switch (layer) {
      case "wall":
        return this.wallTexture;
      case "object":
        return this.objectTexture;
      case "floor":
      default:
        return this.floorTexture;
    }
  }

  private setPlayers(players: Record<string, Hex>): void {
    this.otherMarkers.forEach(({ sprite }) => sprite.destroy());
    this.otherMarkers.clear();
    Object.entries(players).forEach(([id, pos]) => {
      if (id === this.playerId) {
        const { x, y } = hexToWorld(pos);
        this.localMarker.position.set(x, y);
      } else {
        this.addRemotePlayer(id, pos);
      }
    });
  }

  private addRemotePlayer(id: string, pos: Hex): void {
    const sprite = new Graphics();
    sprite.beginFill(0x717b8f, 0.8);
    sprite.drawCircle(0, 0, HEX_TILE_HEIGHT * 0.3);
    sprite.endFill();
    this.markersLayer.addChild(sprite);
    const { x, y } = hexToWorld(pos);
    sprite.position.set(x, y);
    this.otherMarkers.set(id, { id, sprite });
  }

  private updatePlayer(id: string, pos: Hex): void {
    if (id === this.playerId) {
      const { x, y } = hexToWorld(pos);
      this.localMarker.position.set(x, y);
      this.updateHighlight(pos);
      return;
    }
    const marker = this.otherMarkers.get(id);
    if (marker) {
      const { x, y } = hexToWorld(pos);
      marker.sprite.position.set(x, y);
    } else {
      this.addRemotePlayer(id, pos);
    }
  }

  private removePlayer(id: string): void {
    const marker = this.otherMarkers.get(id);
    if (!marker) return;
    marker.sprite.destroy();
    this.otherMarkers.delete(id);
  }

  private sendMove(to: Hex): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.currentMap) return;
    if (to.q < 0 || to.q >= this.currentMap.size.width || to.r < 0 || to.r >= this.currentMap.size.height) {
      return;
    }
    const msg: ClientMsg = { type: "move", to };
    this.ws.send(JSON.stringify(msg));
  }

  private downloadMap(): void {
    if (!this.currentMap) return;
    this.editor.download(this.currentMap);
  }

  private loadMapFile(file: File): void {
    this.editor.upload(file);
  }

  private triggerDownload(map: MapJSON): void {
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${map.id ?? "карта"}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private exportPng(): void {
    const canvas = this.app.canvas;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "карта.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  private toggleEditor(): void {
    const visible = !this.editor.isVisible();
    this.editor.setVisible(visible);
    this.toast.push(visible ? "Редактор включён" : "Редактор выключен");
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      document.body.classList.add("fullscreen-enabled");
    } else {
      void document.exitFullscreen();
      document.body.classList.remove("fullscreen-enabled");
    }
  }

  private registerServiceWorker(): void {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("Не удалось зарегистрировать сервис-воркер", err));
    }
  }
}

function getSocketUrl(): string {
  const envUrl = (import.meta.env.VITE_WS_URL ?? "").trim();
  if (envUrl.length > 0) {
    return envUrl.replace(/\/$/, "");
  }

  const { protocol, host } = window.location;
  const wsProtocol = protocol === "https:" ? "wss" : "ws";
  return `${wsProtocol}://${host}`;
}

function tileKey(layer: MapLayer, q: number, r: number): string {
  return `${layer}:${q}:${r}`;
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isMobile(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}
