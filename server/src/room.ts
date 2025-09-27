import type { WebSocket } from "ws";
import { nanoid } from "nanoid";
import type { Hex, MapJSON, ServerMsg } from "@tla/shared";

interface PlayerState {
  id: string;
  nick: string;
  pos: Hex;
  socket: WebSocket;
}

export class Room {
  private readonly players = new Map<string, PlayerState>();
  private readonly socketIndex = new Map<WebSocket, string>();
  private spawnCursor = 0;

  constructor(public readonly id: string, private readonly map: MapJSON) {}

  getMap(): MapJSON {
    return this.map;
  }

  getPlayerSnapshot(): Record<string, Hex> {
    const snapshot: Record<string, Hex> = {};
    for (const [id, player] of this.players) {
      snapshot[id] = player.pos;
    }
    return snapshot;
  }

  addPlayer(socket: WebSocket, nick: string): PlayerState {
    if (this.players.size >= 8) {
      throw new Error("комната_заполнена");
    }

    const id = nanoid(10);
    const spawn = this.pickSpawn();
    const player: PlayerState = { id, nick, pos: spawn, socket };
    this.players.set(id, player);
    this.socketIndex.set(socket, id);
    return player;
  }

  removeSocket(socket: WebSocket): PlayerState | undefined {
    const id = this.socketIndex.get(socket);
    if (!id) return undefined;
    this.socketIndex.delete(socket);
    const player = this.players.get(id);
    if (player) {
      this.players.delete(id);
    }
    return player;
  }

  getPlayerBySocket(socket: WebSocket): PlayerState | undefined {
    const id = this.socketIndex.get(socket);
    if (!id) return undefined;
    return this.players.get(id);
  }

  movePlayer(playerId: string, to: Hex): Hex {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error("игрок_не_найден");
    }
    if (!Number.isFinite(to.q) || !Number.isFinite(to.r)) {
      throw new Error("некорректный_гекс");
    }

    if (!this.withinBounds(to)) {
      throw new Error("вне_границ");
    }

    player.pos = { q: to.q, r: to.r };
    return player.pos;
  }

  sendTo(playerId: string, msg: ServerMsg): void {
    const player = this.players.get(playerId);
    if (!player) return;
    if (player.socket.readyState === player.socket.OPEN) {
      player.socket.send(JSON.stringify(msg));
    }
  }

  broadcast(msg: ServerMsg, excludePlayerId?: string): void {
    const payload = JSON.stringify(msg);
    for (const player of this.players.values()) {
      if (excludePlayerId && player.id === excludePlayerId) {
        continue;
      }
      if (player.socket.readyState === player.socket.OPEN) {
        player.socket.send(payload);
      }
    }
  }

  private pickSpawn(): Hex {
    const spawns = this.map.spawns?.player;
    if (spawns && spawns.length > 0) {
      const spawn = spawns[this.spawnCursor % spawns.length];
      this.spawnCursor += 1;
      return { ...spawn };
    }
    return { q: 0, r: 0 };
  }

  private withinBounds(hex: Hex): boolean {
    const { width, height } = this.map.size;
    return hex.q >= 0 && hex.q < width && hex.r >= 0 && hex.r < height;
  }
}
